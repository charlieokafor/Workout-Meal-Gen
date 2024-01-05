# Meal and Workout Generator Service

## Project Overview
This service is a backend server application designed to generate personalized meal and workout plans. It integrates with Supabase for data storage and retrieval, utilizes OpenAI's GPT-4 for generating meal and workout suggestions based on user preferences, macros, and available equipment.

## Features
- **Personalized Meal Plan Generation**: Creates meal plans based on user dietary preferences, macros, and selected cuisine.
- **Custom Workout Plan Generation**: Generates workouts considering user's equipment preferences and targeted workout type.
- **Integration with Supabase**: Utilizes Supabase for storing user preferences, generated meal plans, and workout plans.
- **Image Generation**: Uses DALL-E to generate images of meals for visual reference.
- **Credit System**: Manages user credits for generating meal and workout plans.

## Technologies
- Node.js
- Express.js
- Supabase
- OpenAI
- node-fetch

## Installation
Ensure you have Node.js and npm installed before starting.

1. Clone this repository.
2. Install dependencies with `npm install`.
3. Set up your Supabase and OpenAI API keys in the project.

## Usage
Start the server with:

```bash
npm start

## Endpoints
POST /generate-specific-meal: Generates a specific meal plan based on user input.
POST /generate-specific-workout: Creates a workout plan according to user's equipment preferences and workout goals.
The request body for meal plan generation should include userId, userPhrase, and foodType. For workout plan generation, the body should include userId, userPhrase, workoutType, and workoutSubType.

Supabase Schema
The service requires several tables within Supabase for user data, food preferences, equipment preferences, and generated plans. Please refer to the Supabase setup documentation for schema details.

OpenAI Integration
The service uses OpenAI's GPT-4 to process natural language inputs for generating meal and workout plans. Ensure you have the necessary permissions and understand the usage costs associated with OpenAI's API.

## Contributing
Contributions are welcome. Please fork the repository, create a feature branch, and submit a pull request for review.

## License
MIT License

Copyright (c) 2024 Chijindu Chibueze Okafor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## Author
Chijindu Chibueze Okafor
Contact
For any queries or support, please contact us at chijindu12@gmail.com.
