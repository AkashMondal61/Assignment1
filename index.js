import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import os from "os";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables
const app = express();
const PORT =process.env.PORT ;
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
// Custom Error Class for Centralized Error Handling
class err extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
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
        throw new err("fileName is required.", process.env.STATUS_BAD_REQUEST );
    }
    
    // Validate request body - Ensure file path is provided
    if (!Path) {
        throw new err("Path is required.", process.env.STATUS_BAD_REQUEST );
    }

    // Construct the absolute file path using the home directory
    const filePath = path.join(os.homedir(), Path, fileName);
    console.log(filePath)
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        throw new err(`File "${fileName}" not found in the provided path.`, process.env.STATUS_NOT_FOUND);
    }
    console.log(filePath)
    // Initialize counters to track the CSV processing results
    let totalRows = 0;
    let successRows = 0;
    let failedRows = 0;
    const startTime = performance.now();// Record start time for performance measurement

    //  Start reading and processing the CSV file
    fs.createReadStream(filePath)
      .pipe(csv()) // Parse CSV data
      .on("data", (row) => {
          successRows++;
      })
      .on("end", () => {
        // Calculate total processing time
        const endTime = performance.now();
        const timeTaken = `${(endTime - startTime) / 1000} seconds`;
        totalRows = successRows + failedRows;
        logToFile(`Processing Summary: Message: CSV file processed successfully | Total Rows: ${totalRows} | Successful Rows: ${successRows} | Failed Rows: ${failedRows} | Time Taken: ${timeTaken}`);
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
        failedRows++;
        totalRows = successRows + failedRows;
        // Handle any errors that occur while processing the CSV file
        logToFile(`Parsing error at Row ${totalRows}: ${error.message}`);
      });

  } catch (err) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message, status: statusCode });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
