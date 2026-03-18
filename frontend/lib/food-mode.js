export const FOOD_MODE_COOKIE = "food_mode";

export const FOOD_MODES = {
  VEG: "veg",
  NON_VEG: "non-veg",
};

const LEGACY_MEAT_API_CATEGORY = ["B", "e", "e", "f"].join("");

export const NON_VEG_CATEGORIES = [
  "Meat",
  "Chicken",
  "Lamb",
  "Pork",
  "Seafood",
  "Goat",
];

export const VEG_CATEGORIES = [
  "Vegan",
  "Vegetarian",
  "Dessert",
  "Side",
  "Starter",
  "Breakfast",
  "Pasta",
  "Miscellaneous",
];

const NON_VEG_KEYWORDS = [
  "steak",
  "meat",
  "chicken",
  "lamb",
  "pork",
  "mutton",
  "fish",
  "seafood",
  "shrimp",
  "prawn",
  "crab",
  "bacon",
  "ham",
  "turkey",
  "goat",
  "egg",
];

export function normalizeFoodMode(mode) {
  return mode === FOOD_MODES.VEG ? FOOD_MODES.VEG : FOOD_MODES.NON_VEG;
}

export function isNonVegCategory(category) {
  return NON_VEG_CATEGORIES.includes(getDisplayCategoryName(category));
}

export function isVegCategory(category) {
  return VEG_CATEGORIES.includes(getDisplayCategoryName(category));
}

export function isAllowedCategoryByMode(category, mode) {
  if (normalizeFoodMode(mode) === FOOD_MODES.NON_VEG) return true;
  return isVegCategory(category);
}

export function getDisplayCategoryName(category) {
  if (String(category || "").toLowerCase() === LEGACY_MEAT_API_CATEGORY.toLowerCase()) {
    return "Meat";
  }
  return category;
}

export function getApiCategoryFromRoute(category) {
  if (!category) return category;
  const normalized = category.trim().toLowerCase();
  if (normalized === "meat") return LEGACY_MEAT_API_CATEGORY;
  return getDisplayCategoryName(category);
}

export function detectFoodTypeFromText(text) {
  const haystack = String(text || "").toLowerCase();
  return NON_VEG_KEYWORDS.some((keyword) => haystack.includes(keyword))
    ? FOOD_MODES.NON_VEG
    : FOOD_MODES.VEG;
}

export function detectRecipeFoodType(recipe) {
  if (!recipe) return FOOD_MODES.VEG;

  if (recipe.foodType && Object.values(FOOD_MODES).includes(recipe.foodType)) {
    return recipe.foodType;
  }

  if (recipe.category && isNonVegCategory(recipe.category)) {
    return FOOD_MODES.NON_VEG;
  }

  if (recipe.strCategory && isNonVegCategory(recipe.strCategory)) {
    return FOOD_MODES.NON_VEG;
  }

  const ingredients =
    Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
      ? recipe.ingredients
          .map((item) =>
            typeof item === "string" ? item : `${item.item || ""} ${item.amount || ""}`
          )
          .join(" ")
      : "";

  const aggregate = [
    recipe.title,
    recipe.strMeal,
    recipe.description,
    ingredients,
  ]
    .filter(Boolean)
    .join(" ");

  return detectFoodTypeFromText(aggregate);
}

export function isRecipeAllowedForMode(recipe, mode) {
  const normalizedMode = normalizeFoodMode(mode);
  if (normalizedMode === FOOD_MODES.NON_VEG) return true;
  return detectRecipeFoodType(recipe) === FOOD_MODES.VEG;
}
