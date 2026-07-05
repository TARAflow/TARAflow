# TARAflow 0.5.1
### A Semi-automated Threat Modeling Tool for threat analysis and risk assesment

## Description
This project is a web application that allows users to either import existing models or create new ones. Users can upload a .JSON containing a model, which is then parsed and displayed if the parsing is successful. The application also provides functionalities to analyze diagrams and manage threat tables.

## Features
- Import existing models from JSON files.
- Create new models.
- Parse and validate uploaded models.
- Display diagrams, overview table and threat tables.
- Analyze diagrams for dataflows crossing trust boundaries.
- Manage and save threat tables.
- Export threat tables to JSON files.


## Technologies
- **Language**: TypeScript
- **Frameworks**: React, Material-UI

## Installation
1. **Clone the repository**:
    ```bash
    git https://github.com/mirovv/CoReTM-2.0.git
    cd CoReTM-2.0
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Start the development server**:
    ```bash
    npm start / npm dev start
    ```
   **Note**: The application should now be running on [http://localhost:3000](http://localhost:3000).

4. **Build the project**:
    ```bash
    npm run build
    ```

5. **Eject the project**:
    ```bash
    npm run eject
    ```
    **Note**: This is a one-way operation. Once you eject, you can't go back!
   
6. **Build electron**:
	 npx tsc -p tsconfig.electron.json
 	 node scripts/rename-to-cjs.js
	 npm run dev:electron


## Usage
1. **Importing a Model**:
    - Navigate to the Import page.
    - Upload a JSON file containing the model.
    - If the parsing is successful, you will be redirected to the Model page where the model is displayed.
    - Continue with the analysis or change the model.
    - Export the threat model to a JSON.

2. **Creating a New Model**:
    - Navigate to the Create page.
    - Provide the necessary details to create a new model.
    - Save the model and proceed with the analysis.
    - Export the threat model to a JSON.
  
## Known Issues
1. **Browser**:
    - This tool was developed using Google Chrome browser.
    - Functionality and compatibility with other browsers is not guaranteed.
