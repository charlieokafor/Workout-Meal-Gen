import { createClient } from '@supabase/supabase-js';
import express from 'express';
import fetch from 'node-fetch';

import OpenAIApi from "openai"; // Make sure to install openai using `npm install openai`

const supabaseUrl = 'https://ibmmpatcurdnxkyrxaft.supabase.co';
const supabaseKey = 'Enter Supabase Key';

const supabase = createClient(supabaseUrl, supabaseKey);

// Initializing openAi
const openaiApiKey = 'Open Ai Key';
const openai = new OpenAIApi({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });

const app = express();
app.use(express.json());

// fetching macros
async function fetchMacros(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('calories, protein_percent, carb_percent, fat_percent, breakfast_percent, lunch_percent, dinner_percent')
      .eq('id', userId);
    if (error) throw error;
    return data ? data[0] : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// fetching food preferences from their individual tables
async function fetchFoodPreferences(userId) {
  try {
      const viewMappings = {
          dairy: { view: 'user_dairy_view', nameColumn: 'dairy_name' },
          fats: { view: 'user_fats_view', nameColumn: 'fat_name' },
          fruits: { view: 'user_fruits_view', nameColumn: 'fruit_name' },
          grains: { view: 'user_grains_view', nameColumn: 'grain_name' },
          nuts: { view: 'user_nuts_view', nameColumn: 'nut_name' },
          proteins: { view: 'user_proteins_view', nameColumn: 'protein_name' },
          sweets: { view: 'user_sweets_view', nameColumn: 'sweet_name' },
          vegetables: { view: 'user_vegetables_view', nameColumn: 'vegetable_name' }
      };
      
      let preferences = {};

      for (let category in viewMappings) {
          const { view, nameColumn } = viewMappings[category];

          const { data, error } = await supabase
              .from(`${view}`)
              .select(`${nameColumn}, preference`)
              .eq('user_id', userId)
              .eq('preference', true);

          if (error) throw error;
          preferences[category] = data;
      }

      return preferences;
  } catch (error) {
      console.error(error);
  }
}

// fetch equipment preferences
async function fetchEquipmentPreferences(userId) {
  try {
    const viewMappings = {
      core: { view: 'user_core_equipment_view', nameColumn: 'core_equipment_name' },
      lower_body: { view: 'user_lower_body_equipment_view', nameColumn: 'lower_body_equipment_name' },
      upper_body: { view: 'user_upper_body_equipment_view', nameColumn: 'upper_body_equipment_name' },
      cardio: { view: 'user_cardio_equipment_view', nameColumn: 'cardio_equipment_name' }
    };

    let allPreferences = [];

    for (let category in viewMappings) {
      const { view, nameColumn } = viewMappings[category];

      const { data, error } = await supabase
        .from(view)
        .select(`${nameColumn}, preference`)
        .eq('user_id', userId)
        .eq('preference', true);

      if (error) throw error;
      allPreferences.push(...data.map(item => ({ ...item, category })));
    }

    // Shuffle and select 6 random preferences
    allPreferences.sort(() => 0.5 - Math.random());
    let selectedPreferences = allPreferences.slice(0, 6);

    // Reconstruct the preferences object in the original format
    let preferences = { core: [], lower_body: [], upper_body: [], cardio: [] };
    selectedPreferences.forEach(pref => {
      preferences[pref.category].push(pref);
    });

    return preferences;
  } catch (error) {
    console.error(error);
    return {};
  }
}




async function updateCreditAmount(userId) {
  try {
      // Retrieve the current credit amount
      let { data: user, error: getUserError } = await supabase
          .from('users')
          .select('credit_amount')
          .eq('id', userId)
          .single();

      if (getUserError) {
          console.error('Error fetching user:', getUserError);
          return { error: getUserError };
      }

      // Check if user has enough credits
      if (user.credit_amount <= 0) {
          return { error: 'Not enough credits' };
      }

      // Decrement the credit amount
      let newCreditAmount = user.credit_amount - 1;

      // Update the user's credit amount
      let { error: updateError } = await supabase
          .from('users')
          .update({ credit_amount: newCreditAmount })
          .eq('id', userId);

      if (updateError) {
          console.error('Error updating credit amount:', updateError);
          return { error: updateError };
      }

      return { data: 'Credit amount updated successfully' };
  } catch (error) {
      console.error('Unexpected error in updateCreditAmount:', error);
      return { error };
  }
}

// Function to generate an image using DALL-E
async function generateImage(mealNameValue) {
  const openaiImage = new OpenAIApi({ apiKey: openaiApiKey });

  try {
    const response = await openaiImage.images.generate({
      prompt: `Create a high-resolution, detailed image showcasing an authentic dish from the ${mealNameValue} cuisine. The image should focus on a single, well-prepared serving of the dish, featuring its key ingredients in a visually appealing arrangement. Emphasize the fresh, vibrant colors and textures of the food, making each ingredient distinctly recognizable. Present the meal on a plate that reflects the ${mealNameValue} culinary tradition, set against a simple, uncluttered background to keep the focus on the dish. Use bright, balanced lighting to highlight the natural appeal of the meal, avoiding any effects that could cause blurriness or distortion. The goal is to produce a realistic and appetizing representation of the meal dish, captured in a style akin to high-end culinary photography, ensuring the image is crisp, clear, and inviting.`,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid" // or "natural" depending on your preference
    // Ensure this size is supported by DALL-E
    });
    // Log the full response to inspect its structure
    console.log(JSON.stringify(response, null, 2));
    // Correctly extract and return the image URL from the response
    // Adjust the path according to the actual response structure
    const imageUrl = response.data[0].url;
    return imageUrl;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}
// Use the function and inspect what it logs

// generating meal based of macro data user preferences and the userphrase
async function generateSpecificMeal(foodType, userPhrase, userPreferences, macros, userId) {
  try {
    // Convert foodType to an integer
    const foodTypeInt = parseInt(foodType, 10);
    console.log('foodType:', foodType); // Log the original foodType
    console.log('foodTypeInt:', foodTypeInt); // Log the parsed integer
    // Flatten user preferences into a single array
    let likedItems = [];
    for (let category in userPreferences) {
      for (let idx in userPreferences[category]) {
        const item = userPreferences[category][idx];
        if (item.preference) {
          const nameKey = Object.keys(item).filter(key => key !== 'preference')[0];
          const name = item[nameKey];
          likedItems.push(name);
        }
      }
    }

    const likesString = likedItems.join(', ');
    let mealType;
    let mealPercent;
    switch(foodTypeInt) {
      case 0: 
        mealType = 'breakfast';
        mealPercent = macros.breakfast_percent;
        break;
      case 1:
        mealType = 'lunch';
        mealPercent = macros.lunch_percent;
        break;
      case 2:
        mealType = 'dinner';
        mealPercent = macros.dinner_percent;
        break;
      default:
        throw new Error('Invalid food type');
    }
    // Apply percentages to macros
    const mealMacros = {
      calories: macros.calories * mealPercent,
      protein_percent: macros.protein_percent * mealPercent,
      carb_percent: macros.carb_percent * mealPercent,
      fat_percent: macros.fat_percent * mealPercent,
  };
    const withPhrase = userPhrase ? ` I am interested in ${userPhrase} ${mealType} meals.` : '';
    const prompt = `I like the following foods: ${likesString}.${withPhrase} My dietary preferences for ${mealType} meals are:
    Calories: ${mealMacros.calories}
    Protein: ${mealMacros.protein_percent}%
    Carbs: ${mealMacros.carb_percent}%
    Fat: ${mealMacros.fat_percent}%
    Generate me an authentic meal, from the cuisine of ${userPhrase}. use only ingredient needed in the authentic recipie and do not add items not needed in an authentic recipie to a dish`;

    // OpenAI completion request
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a meal planner. The user will tell you the foods they like, then they will tell you what type of meal they are interested in now, and their dietary preferences like Calories, Protein, Carbs, and Fat. You will provide an AUTHENTIC, i repeat, AUTHENTIC ${mealType} meal plan based on that. Ensure to add the appropriate measurements so user know how much to eat to hit his/her goal with the serving size included to the recipie so user knows how much from the cooked meal to eat to hit the specified caloris and macros. Serving size should tell how much of cooked food to eat something like this 100g fried rice 2 pieces or 100g jerk chicken so they know how much to eat to hit the exact calories of the meal
          Respond with the exact following format in json:
            - Meal_name: String
            - Cuisine: String
            - Food_description: String
            - Ingredients: String
            - Cooking_Time: Integer
            - Recipe: String
            - Calories: Integer
            - Protein: Integer
            - Fat: Integer
            - Carbs: Integer
            - Serving_size: String
          `
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "gpt-4",
    });
    // Parsing the GPT-4 response into JSON
    const raw = completion.choices[0].message.content;
    let json;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      console.error('Failed to parse raw data:', error);
      return null;
    }
    
    // Choose the right table and property names based on foodType
    let tableName, mealName;
    switch(foodTypeInt) {
      case 0:
        tableName = 'user_temp_gen';
        mealName = 'Breakfast_name';
        break;
      case 1:
        tableName = 'user_temp_gen';
        mealName = 'Lunch_name';
        break;
      case 2:
        tableName = 'user_temp_gen';
        mealName = 'Dinner_name';
        break;
      // add more cases as needed
      default:
        console.error('Invalid food type for table selection');
        return null;
    }

    // Destructure JSON object based on the mealName
    const {
      Meal_name: mealNameValue,
      Food_description: foodDescription,
      Ingredients: ingredients,
      Cooking_Time: cookingTime,
      Recipe: recipe,
      Calories: calories,
      Protein: protein,
      Fat: fats,
      Carbs: carbs,
      Serving_size: Serving_Size
    } = json;

    // DALL-E image generation based on Meal_name and Food_description
    const imageUrl = await generateImage(mealNameValue);
    console.log('imageurl:', imageUrl);
    // assuming ingredients is a string and needs to be an array
    let uploadedImageUrl;
    if (imageUrl) {
      uploadedImageUrl = await uploadImageToSupabase(imageUrl, userId);
    }
    // Insert data into the appropriate table
    const { data, error } = await supabase
      .from(tableName)
      .insert({
          user_id: userId,  
          meal_type: foodTypeInt,
          meal_name: mealNameValue,
          food_description: foodDescription,
          ingredients: ingredients,  // Assuming Ingredients is an array
          cooking_time: cookingTime,
          recipe: recipe,
          calories: calories,
          protein: protein,
          fats: fats,
          carbs: carbs,
          serving_size: Serving_Size,
          image_url: uploadedImageUrl // Add the image URL to the database record
      });

    if (error) {
      console.error('Supabase upsert error:', error);
      return null;
    }
    console.log('Supabase upsert data:', data);
    
    // Update the credit amount
    const creditUpdateResponse = await updateCreditAmount(userId);
    if (creditUpdateResponse.error) {
      console.error('Error updating credit amount:', creditUpdateResponse.error);
    }

    return json;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Function to fetch the image from the URL and upload it to Supabase
async function uploadImageToSupabase(url, userId) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Unable to fetch the image: ${res.statusText}`);
    const buffer = await res.buffer();
    
    // Construct a unique file path
    const filePath = `images/${userId}/${Date.now()}-meal.png`;

    // Upload the image to Supabase Storage
    const { data, error } = await supabase.storage
      .from('image_generation')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) throw error;

    // Return the public URL to the uploaded image
    return `${supabaseUrl}/storage/v1/object/public/image_generation/${filePath}`;
  } catch (error) {
    console.error('Error uploading image to Supabase:', error);
    return null;
  }
}

// generate workout
async function generateSpecificWorkout(workoutSubType, workoutType, userPhrase, equipmentPreferences, userId) {
  try {
    // Convert workoutType to an integer
    const workoutTypeInt = parseInt(workoutType, 10);
    const workoutSubTypeInt = parseInt(workoutSubType, 10);

    console.log('workoutTypeInt:', workoutTypeInt);
    console.log('workoutSubTypeInt:', workoutSubTypeInt);

    // Flatten equipment preferences into a single array
    let preferredEquipments = [];
    for (let category in equipmentPreferences) {
      for (let idx in equipmentPreferences[category]) {
        const item = equipmentPreferences[category][idx];
        if (item.preference) {
          const nameKey = Object.keys(item).filter(key => key !== 'preference')[0];
          const name = item[nameKey];
          preferredEquipments.push(name);
        }
      }
    }
    let workoutCategory;
    let workoutSubCategory;
    switch(workoutTypeInt) {
      case 0:
        workoutCategory = 'Upper Body Push';
        switch(workoutSubTypeInt) {
          case 0:
            workoutSubCategory = 'Chest';
            break;
          case 1:
            workoutSubCategory = 'Shoulder';
            break;
          case 2:
            workoutSubCategory = 'Upper arms';
            break;
          default:
            throw new Error('Invalid sub workout type');
        }
        break;
      case 1:
        workoutCategory = 'Upper Body Pull';
        switch(workoutSubTypeInt) {
          case 0:
            workoutSubCategory = 'Lower arms';
            break;
          case 1:
            workoutSubCategory = 'Back';
            break;
          default:
            throw new Error('Invalid sub workout type');
        }
        break;
      case 2:
        workoutCategory = 'Lower Body';
        switch(workoutSubTypeInt) {
          case 0:
            workoutSubCategory = 'Lower legs';
            break;
          case 1:
            workoutSubCategory = 'Upper legs';
            break;
          default:
            throw new Error('Invalid sub workout type');
        }
        break;
      case 3:
        workoutCategory = 'Core/Cardio';
        switch(workoutSubTypeInt) {
          case 0:
            workoutSubCategory = 'Waist';
            break;
          case 1:
            workoutSubCategory = 'Cardio';
            break;
          default:
            throw new Error('Invalid sub workout type');
        }
        break;
      default:
        throw new Error('Invalid workout type');
    }
    
    // Query the workout_data table for exercises matching the equipment preferences
    const { data: exercises, error: exercisesError } = await supabase
      .from('workout_data')
      .select('name, target, bodyPart')
      .in('equipment', preferredEquipments);

      if (exercisesError) throw exercisesError;

      let workoutSubCategoryUpper = workoutSubCategory.toUpperCase();
      workoutSubCategory = workoutSubCategory.toLowerCase();
      // Separate exercises into two categories
      const matchingExercises = exercises.filter(ex => ex.bodyPart === workoutSubCategory);
      const otherExercises = exercises.filter(ex => ex.bodyPart !== workoutSubCategory);

      // Shuffle the otherExercises to randomize
      for (let i = otherExercises.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherExercises[i], otherExercises[j]] = [otherExercises[j], otherExercises[i]];
      }

      // Combine matching exercises with a random selection of other exercises
      const totalExercisesNeeded = 200 - matchingExercises.length;
      const randomExercises = otherExercises.slice(0, totalExercisesNeeded);
      const combinedExercises = [...matchingExercises, ...randomExercises];

      // Convert combined list to a string for the prompt
      let exercisesList = combinedExercises.map(ex => `names of the exercises are (${ex.name}) the target parts of the exercises are ${ex.target} and the bodypart for the exercises are ${ex.bodyPart}`).join('; ');

      const prompt = `Based on the user's preference for ${preferredEquipments.join(', ')} equipment, here are some exercises: ${exercisesList}. You can use ${userPhrase} to be more specific about the bodypart in specific the user wants, but you should not use it to generate anything that has not been given to you in data. Please suggest six exercises from this list for a workout plan RANDOMLY. The response must be the exact name(s) from the data given and must be in lowercase, along with sets and reps for each.`;



    // OpenAI completion request
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a workout planner. The user will tell you the equipment they prefer and what type of workout they are interested in. You will provide a ${workoutCategory} workout with a ${workoutSubCategory} subcategory, based on that create a workout with a total of 6 exercises using the name of the workout from the data given and add sets and reps. 
          Respond with the exact following format in json and note that the ExerciseName should match the exact name in the exercise data given and must be in lowercase:
            - ExerciseName_1: String
            - Sets_1: Integer
            - Reps_1: Integer
            - ExerciseName_2: String
            - Sets_2: Integer
            - Reps_2: Integer
            - ExerciseName_3: String
            - Sets_3: Integer
            - Reps_3: Integer
            - ExerciseName_4: String
            - Sets_4: Integer
            - Reps_4: Integer
            - ExerciseName_5: String
            - Sets_5: Integer
            - Reps_5: Integer
            - ExerciseName_6: String
            - Sets_6: Integer
            - Reps_6: Integer
            `
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "gpt-4",
    });

    // Parsing the OpenAI response into a suitable format
    const raw = completion.choices[0].message.content;
    let workoutPlan;
    try {
      console.log('Raw response:', raw);
      workoutPlan = JSON.parse(raw); // Adjust the parsing logic based on the actual response format
    } catch (error) {
      console.error('Failed to parse raw data:', error);
      return null;
    }
    
        // Prepare data for insertion
    let insertData = {
      user_id: userId, 
      type_int: workoutTypeInt,
      sub_type_int: workoutSubTypeInt,
      type_string: workoutCategory,
      sub_type_string: workoutSubCategoryUpper
    };

    // Loop through the response to add exercise details to insertData
    for (let i = 1; i <= 6; i++) {
      insertData[`exercise_id_${i}`] = workoutPlan[`ExerciseName_${i}`];
      insertData[`sets_${i}`] = workoutPlan[`Sets_${i}`];
      insertData[`reps_${i}`] = workoutPlan[`Reps_${i}`];
    }

    // Insert data into Supabase
    try {
      const response = await supabase
        .from('user_temp_workout_gen')
        .insert([insertData]);
    
      if (!response) {
        console.error('Supabase response is null');
        return null;
      }
    
      if (response.error) {
        console.error('Supabase insert error:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error inserting data into Supabase:', error);
      return null;
    }
    



    // Update the user's credit amount after generating the workout plan
    const creditUpdateResponse = await updateCreditAmount(userId);
    if (creditUpdateResponse && creditUpdateResponse.error) {
      console.error('Error updating credit amount:', creditUpdateResponse.error);
      return null; // or handle the error differently as per your application's logic
    }

    return workoutPlan;
  } catch (error) {
    console.error('Error in generateSpecificWorkout:', error);
    return null;
  }
}


// new route to handle specific meal plan generation
app.post('/generate-specific-meal', async (req, res) => {
  // Extracting userId, userPhrase, and foodType from the request body
  const userId = req.body.userId;
  const userPhrase = req.body.userPhrase;
  const foodType = req.body.foodType; // This should be 0, 1, or 2 for breakfast, lunch, or dinner respectively
  // Logging the received data
  console.log('Received userId:', userId);
  console.log('Received userPhrase:', userPhrase);
  console.log('Received foodType:', foodType);

  try {
    // Fetch user preferences and macros
    const userPreferences = await fetchFoodPreferences(userId);
    const macros = await fetchMacros(userId);

    // Generate the specific meal plan
    const mealPlan = await generateSpecificMeal(foodType, userPhrase, userPreferences, macros, userId);

    // Check if meal plan was successfully generated
    if (mealPlan) {
      res.json({mealPlan});
    } else {
      res.status(500).json({ message: "Error generating meal plan" });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// route for workout
app.post('/generate-specific-workout', async (req, res) => {
  const userId = req.body.userId;
  const userPhrase = req.body.userPhrase;
  const workoutType = req.body.workoutType;
  const workoutSubType = req.body.workoutSubType;

  // Input validation (Add this part)
  if (!userId || isNaN(workoutType) || !Number.isInteger(workoutType)) {
    return res.status(400).json({ message: "Invalid input parameters" });
  }

  try {
    const equipmentPreferences = await fetchEquipmentPreferences(userId);
    const workoutPlan = await generateSpecificWorkout(workoutSubType, workoutType, userPhrase, equipmentPreferences, userId);

    if (workoutPlan && !workoutPlan.error) {
      res.json({ workoutPlan });
    } else {
      console.error('Error generating workout plan:', workoutPlan.error); // Improved error logging
      res.status(500).json({ message: workoutPlan.error || "Error generating workout plan" });
    }
  } catch (error) {
    console.error('Error:', error); // Detailed error logging
    res.status(500).json({ message: `Internal Server Error: ${error.message}` }); // Return detailed error message
  }
});


//listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// Optional: Fetch food preferences for testing
// fetchFoodPreferences('057cc288-9e8b-457b-a383-07260d20ad4e');                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
