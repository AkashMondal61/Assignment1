import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import os from "os";

const app = express();
const PORT = 3000;
const LOG_FILE = "logs/app.log"; // Log file path for storing processing logs

app.use(express.json()); // Middleware to parse incoming JSON requests

// Ensure the "logs" directory exists; create it if missing
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}

// Function to append log messages to the log file
const logToFile = (message) => {
  fs.appendFileSync(LOG_FILE, message + "\n");
};

// API Endpoint: Root - Provides a simple UI with available endpoints
app.get("/", (req, res) => {
  console.log(os.homedir()); // Log the home directory for debugging
  res.send(`
    <ul>
      <li><strong>POST</strong> <a href="http://localhost:${PORT}/api/report-service/parse-csv" target="_blank">/api/report-service/parse-csv</a></li>
    </ul>`);
});

// API Endpoint: Parse CSV File
app.post("/api/report-service/parse-csv", (req, res) => {
  try {
    const { fileName, Path } = req.body;

    // Validate request body - Ensure fileName is provided
    if (!fileName) {
      return res.status(400).json({ error: "fileName is required." });
    }
    
    // Validate request body - Ensure file path is provided
    if (!Path) {
      return res.status(400).json({ error: "Path is required." });
    }

    // Construct the absolute file path using the home directory
    const filePath = path.join(os.homedir(), Path, fileName);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File "${fileName}" not found in the provided path.` });
    }

    // Initialize counters to track the CSV processing results
    let totalRows = 0;
    let successRows = 0;
    let failedRows = 0;
    const startTime = Date.now(); // Record start time for performance measurement

    //  Start reading and processing the CSV file
    fs.createReadStream(filePath)
      .pipe(csv()) // Parse CSV data
      .on("data", (row) => {
        totalRows++; // Count each row

        // 🔎 Identify missing columns (empty values)
        let missingColumns = Object.keys(row).filter((col) => !row[col].trim());

        // If missing values are found, log the issue
        if (missingColumns.length > 0) {
          failedRows++;
          logToFile(`Row ${totalRows} has missing values at: ${missingColumns.join(", ")}`);
        } else {
          successRows++; //  Row successfully processed
        }
      })
      .on("end", () => {
        // Calculate total processing time
        const endTime = Date.now();
        const timeTaken = `${(endTime - startTime) / 1000} seconds`;

        //  Send the processing summary as JSON response
        res.json({
          message: "CSV file processed successfully",
          totalRows,
          successRows,
          failedRows,
          timeTaken,
        });
      })
      .on("error", (error) => {
        // Handle any errors that occur while processing the CSV file
        res.status(500).json({ error: "Error processing the CSV file" });
      });

  } catch (error) {
    //  Catch and handle unexpected server errors
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
