"use server";

import { cookies } from "next/headers";
import {
  FOOD_MODE_COOKIE,
  FOOD_MODES,
  detectRecipeFoodType,
  getApiCategoryFromRoute,
  isAllowedCategoryByMode,
  isNonVegCategory,
  normalizeFoodMode,
} from "@/lib/food-mode";

const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";
const RECIPE_DAY_REVALIDATE = 86400;

async function getModeFromCookies() {
  const cookieStore = await cookies();
  const mode = cookieStore.get(FOOD_MODE_COOKIE)?.value;
  return normalizeFoodMode(mode);
}

function getDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hashString(input) {
  return input.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

async function fetchRandomMeal(mode, slot, dayKey) {
  const response = await fetch(
    `${MEALDB_BASE}/random.php?mode=${mode}&slot=${slot}&day=${dayKey}`,
    {
      next: { revalidate: RECIPE_DAY_REVALIDATE },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recipe of the day");
  }

  const data = await response.json();
  return data.meals?.[0] || null;
}

async function fetchMealById(idMeal, dayKey = getDayKey()) {
  const response = await fetch(`${MEALDB_BASE}/lookup.php?i=${idMeal}&day=${dayKey}`, {
    next: { revalidate: RECIPE_DAY_REVALIDATE },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.meals?.[0] || null;
}

async function fetchVegFallbackMeal(dayKey) {
  const response = await fetch(`${MEALDB_BASE}/filter.php?c=Vegetarian&day=${dayKey}`, {
    next: { revalidate: RECIPE_DAY_REVALIDATE },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const meals = data.meals || [];
  if (meals.length === 0) return null;

  const index = hashString(`${dayKey}-${FOOD_MODES.VEG}`) % meals.length;
  const picked = meals[index];
  return fetchMealById(picked.idMeal, dayKey);
}

// Get random recipe of the day
export async function getRecipeOfTheDay() {
  try {
    const mode = await getModeFromCookies();
    const dayKey = getDayKey();

    let fallback = null;
    for (let i = 0; i < 25; i += 1) {
      const meal = await fetchRandomMeal(mode, i, dayKey);
      if (!meal) continue;
      if (!fallback) fallback = meal;

      const isNonVeg = isNonVegCategory(meal.strCategory);
      if (mode === FOOD_MODES.VEG && !isNonVeg) {
        return {
          success: true,
          recipe: meal,
        };
      }
      if (mode === FOOD_MODES.NON_VEG && isNonVeg) {
        return {
          success: true,
          recipe: meal,
        };
      }
    }

    if (mode === FOOD_MODES.VEG) {
      const vegFallback = await fetchVegFallbackMeal(dayKey);
      if (vegFallback) {
        return {
          success: true,
          recipe: vegFallback,
        };
      }
      return {
        success: true,
        recipe: null,
      };
    }

    return {
      success: true,
      recipe: fallback,
    };
  } catch (error) {
    console.error("Error fetching recipe of the day:", error);
    throw new Error(error.message || "Failed to load recipe");
  }
}

// Get all categories
export async function getCategories() {
  try {
    const mode = await getModeFromCookies();
    const response = await fetch(`${MEALDB_BASE}/list.php?c=list`, {
      next: { revalidate: 604800 }, // Cache for 1 week (categories rarely change)
    });

    if (!response.ok) {
      throw new Error("Failed to fetch categories");
    }

    const data = await response.json();
    const categories = (data.meals || []).filter((item) =>
      isAllowedCategoryByMode(item.strCategory, mode)
    );

    if (mode === FOOD_MODES.NON_VEG) {
      categories.sort((a, b) => {
        const aScore = isNonVegCategory(a.strCategory) ? 0 : 1;
        const bScore = isNonVegCategory(b.strCategory) ? 0 : 1;
        return aScore - bScore;
      });
    }

    return {
      success: true,
      categories,
    };
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw new Error(error.message || "Failed to load categories");
  }
}

// Get all areas/cuisines
export async function getAreas() {
  try {
    const response = await fetch(`${MEALDB_BASE}/list.php?a=list`, {
      next: { revalidate: 604800 }, // Cache for 1 week
    });

    if (!response.ok) {
      throw new Error("Failed to fetch areas");
    }

    const data = await response.json();
    return {
      success: true,
      areas: data.meals || [],
    };
  } catch (error) {
    console.error("Error fetching areas:", error);
    throw new Error(error.message || "Failed to load areas");
  }
}

// Get meals by category
export async function getMealsByCategory(category) {
  try {
    const mode = await getModeFromCookies();
    const apiCategory = getApiCategoryFromRoute(category);

    if (!isAllowedCategoryByMode(apiCategory, mode)) {
      return {
        success: true,
        meals: [],
        category: apiCategory,
      };
    }

    const response = await fetch(`${MEALDB_BASE}/filter.php?c=${apiCategory}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error("Failed to fetch meals");
    }

    const data = await response.json();
    return {
      success: true,
      meals: data.meals || [],
      category: apiCategory,
    };
  } catch (error) {
    console.error("Error fetching meals by category:", error);
    throw new Error(error.message || "Failed to load meals");
  }
}

// Get meals by area
export async function getMealsByArea(area) {
  try {
    const mode = await getModeFromCookies();
    const response = await fetch(`${MEALDB_BASE}/filter.php?a=${area}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error("Failed to fetch meals");
    }

    const data = await response.json();
    const meals = data.meals || [];

    // Resolve each meal category so we can enforce veg/non-veg mode.
    const mealsWithDetails = await Promise.all(
      meals.map(async (meal) => {
        try {
          const detailResponse = await fetch(
            `${MEALDB_BASE}/lookup.php?i=${meal.idMeal}`,
            { next: { revalidate: 86400 } }
          );
          if (!detailResponse.ok) return meal;
          const detailData = await detailResponse.json();
          const detailMeal = detailData.meals?.[0];
          return detailMeal ? { ...meal, strCategory: detailMeal.strCategory } : meal;
        } catch {
          return meal;
        }
      })
    );

    let filteredMeals = mealsWithDetails;
    if (mode === FOOD_MODES.VEG) {
      filteredMeals = mealsWithDetails.filter(
        (meal) => detectRecipeFoodType(meal) === FOOD_MODES.VEG
      );
    } else {
      filteredMeals = mealsWithDetails.sort((a, b) => {
        const aScore = detectRecipeFoodType(a) === FOOD_MODES.NON_VEG ? 0 : 1;
        const bScore = detectRecipeFoodType(b) === FOOD_MODES.NON_VEG ? 0 : 1;
        return aScore - bScore;
      });
    }

    return {
      success: true,
      meals: filteredMeals,
      area,
    };
  } catch (error) {
    console.error("Error fetching meals by area:", error);
    throw new Error(error.message || "Failed to load meals");
  }
}