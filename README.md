# FILE: /node-audio-upload-app/node-audio-upload-app/README.md

# Node Audio Upload App

This project is a Node.js application that allows users to upload audio recordings to Google Drive and update an RSS feed XML file on GitHub. It includes user authentication and file handling features.

## Features

- User authentication using Google OAuth2
- Upload audio recordings to Google Drive
- Update RSS feed XML file on GitHub
- Simple web interface for file uploads

## Project Structure

```
node-audio-upload-app
├── src
│   ├── controllers
│   ├── routes
│   ├── services
│   ├── views
│   └── app.js
├── config
├── public
│   └── styles.css
├── package.json
├── .gitignore
└── README.md
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd node-audio-upload-app
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Set up Google OAuth2 credentials and update `config/google_app.json` with your client ID, client secret, and redirect URIs.

## Usage

1. Start the application:
   ```
   npm start
   ```

2. Open your web browser and navigate to `http://localhost:3000/` to access the upload page.

3. Click the Authenticate link to log into Google.

4. Use the form to upload audio recordings and authenticate with Google.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.