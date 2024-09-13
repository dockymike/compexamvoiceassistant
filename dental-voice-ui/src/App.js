import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [chiefComplaint, setChiefComplaint] = useState(""); // Holds the summarized chief complaint
  const [isRecording, setIsRecording] = useState(false);
  const socket = useRef(null);  // WebSocket reference
  const recognition = useRef(null);  // SpeechRecognition reference

  useEffect(() => {
    socket.current = new WebSocket('ws://localhost:5000');  // Connect to WebSocket server

    socket.current.onopen = () => {
      console.log('WebSocket connection established');
    };

    socket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.transcription) {
        setChiefComplaint(data.transcription);  // Update the chief complaint summary
      }
    };

    socket.current.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      if (socket.current) {
        socket.current.close();  // Close WebSocket on cleanup
      }
    };
  }, []);

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Your browser does not support speech recognition. Please use Chrome or another supported browser.');
      return;
    }

    recognition.current = new SpeechRecognition();
    recognition.current.continuous = true;
    recognition.current.interimResults = true;
    recognition.current.lang = 'en-US';

    recognition.current.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript && socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(finalTranscript);  // Send the final transcription to server
      }
    };

    recognition.current.start();
    setIsRecording(true);  // Set recording state
  };

  const stopRecording = () => {
    if (recognition.current) {
      recognition.current.stop();
      recognition.current = null;  // Stop speech recognition
    }
    setIsRecording(false);  // Set recording state
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Dental Comp Exam Voice Assistant</h1>
        <section>
          <h2>Chief Complaint</h2>
          <p>{chiefComplaint || "Real-time transcription will appear here."}</p>  {/* Show summarized chief complaint */}
        </section>
        <button onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </header>
    </div>
  );
}

export default App;
