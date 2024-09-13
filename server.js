const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const port = 5000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const OPENAI_API_KEY = '';  // Replace with your OpenAI API key

// Function to call OpenAI API for summarization with examples in the prompt
async function summarizeWithChatGPT(conversation) {
    const prompt = `
    As a dental assistant, extract and summarize the patient's chief complaint based on the transcription. Focus only on dental relevant information and terminology provided, such as symptoms, duration, severity, and triggers. Use the most recent information when there are discrepancies or corrections. Ignore any irrelevant or casual remarks.
  
    ### Examples:
  
    Transcription:
    "Hi, what brings you in today."
    Summary: "No relevant information detected yet."
  
    Transcription:
    "Hi, what brings you in today. I'm having pain in my upper right."
    Summary: "The patient's chief complaint is pain located in their upper right section of the mouth. No specifics on duration, severity, or triggers have been provided yet."
  
    Transcription:
    "Hi, what brings you in today. I'm having pain in my upper right. Do you know what causes the pain?"
    Summary: "The patient's main complaint is pain in the upper right area of the mouth. No further details about the root causes, duration, severity, or triggers of the pain were provided by the patient."
  
    Transcription:
    "Hi, what brings you in today. I'm having pain in my upper right. Do you know what causes the pain? No."
    Summary: "The patient is experiencing pain in the upper right section of their mouth. They do not know what is causing the pain. No information is provided regarding the duration or severity of the pain."

    Transcription:
    "Hi, what brings you in today. I'm having pain in my upper right. Do you know what causes the pain? No. Does it hurt more when you chew?"
    Summary: "The patient is experiencing pain in the upper right section of their mouth.  The cause of the pain is unknown to the patient. No information about if the pain worsens when chewing was given. No information is provided regarding the duration or severity of the pain."

    Transcription:
    "Hi, what brings you in today. I'm having pain in my upper right. Do you know what causes the pain? No. Does it hurt more when you chew? Yes."
    Summary: "The patient is experiencing pain in the upper right section of their mouth.  They are unsure of the cause, however, the patient does confirm that the pain intensifies when they are chewing. No information regarding the duration or severity of the pain has been provided."

    Transcription:
    "Hi, what brings you in today. I'm having pain in my upper right. Do you know what causes the pain? No. Does it hurt more when you chew? Yes. Sorry I fidget a lot."
    Summary: "The patient is experiencing pain in the upper right section of their mouth.  They are unsure of the cause, however, the patient does confirm that the pain intensifies when they are chewing. No information regarding the duration or severity of the pain has been provided."

    Transcription:
    "Hi, what brings you in today. I'm having pain in my upper right. Do you know what causes the pain? No. Does it hurt more when you chew? Yes. Sorry I fidget a lot. Actually the pain is in the upper left."
    Summary: "The patient's chief complaint is pain located in the upper left section of their mouth. The pain intensifies when they chew. The cause of the pain is unknown to the patient. No information regarding the duration or severity of the pain has been provided."

    ### Current Transcription:
    "${conversation}"
  
    Chief Complaint Summary:`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2, // Lower temperature for more focused responses
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const summary = response.data.choices[0].message.content.trim();
    return summary;
  } catch (error) {
    console.error('Error during OpenAI summarization:', error.response?.data || error.message);
    return conversation; // If the API call fails, return the original conversation
  }
}

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  // Initialize the arrays and flags
  let conversationHistory = "";  // This stores the full conversation history
  let aiSummary = "";  // This stores the AI-generated summary
  let hasNewTranscription = false;  // Flag to track if there's new content

  // Function to handle transcription and summarize if there's new content
  const processSummarization = async () => {
    try {
      if (hasNewTranscription && conversationHistory) {
        // Summarize the current conversation history
        aiSummary = await summarizeWithChatGPT(conversationHistory);

        // Reset the flag since the new content has been processed
        hasNewTranscription = false;

        // Send the updated summary back to the client (UI)
        ws.send(JSON.stringify({ transcription: aiSummary }));
      }
    } catch (error) {
      console.error('Error during summarization:', error);
    }
  };

  // Debounced processing of new content (waits for 2 seconds of inactivity before summarizing)
  let debounceTimeout;
  const debounceSummarization = () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(processSummarization, 0); // Wait for 0 seconds after the last transcription
  };

  ws.on('message', (message) => {
    // Append the incoming transcription to the conversation history
    conversationHistory += message.toString();

    // Mark that there's new transcription content
    hasNewTranscription = true;

    // Start the debounce timer
    debounceSummarization();
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clearTimeout(debounceTimeout);  // Stop processing if the connection is closed
  });
});

server.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
