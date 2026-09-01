/**
 * Feature 7: Voice-First MargDarshak
 *
 * A global floating voice assistant that listens for commands (including Hinglish)
 * and navigates or interacts with the app contextually.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, Loader2, X } from 'lucide-react';

export function VoiceNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showToast, setShowToast] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      // Defaulting to Hindi/English mixed context if supported, otherwise en-IN
      recognition.lang = 'hi-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setShowToast(true);
        setTranscript('Listening...');
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const result = event.results[current][0].transcript;
        setTranscript(result);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setTranscript(`Error: ${event.error}`);
        setTimeout(() => setShowToast(false), 3000);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Process the final transcript
        const currentTranscript = recognitionRef.current?.finalTranscript || '';
        if (currentTranscript) {
          processVoiceCommand(currentTranscript.toLowerCase());
        } else {
          setTimeout(() => setShowToast(false), 2000);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Update ref so onend closure has access to latest transcript
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.finalTranscript = transcript;
    }
  }, [transcript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const processVoiceCommand = (command: string) => {
    console.log('Voice Command:', command);
    
    // Simple NLU routing for the prototype
    if (command.includes('home') || command.includes('dashboard') || command.includes('wapas')) {
      navigate('/dashboard');
      setTranscript('Navigating home...');
    } else if (command.includes('plan') || command.includes('trip') || command.includes('yatra')) {
      navigate('/destinations');
      setTranscript('Opening destinations...');
    } else if (command.includes('group') || command.includes('dost')) {
      navigate('/group');
      setTranscript('Opening group planner...');
    } else if (command.includes('profile') || command.includes('account')) {
      navigate('/profile');
      setTranscript('Opening profile...');
    } else {
      // If we are on the trip details page, maybe it's a what-if query?
      if (location.pathname.includes('/trip/')) {
        setTranscript(`Contextual query: ${command}`);
        // In a real app, we'd inject this into the WhatIfPanel context
      } else {
        setTranscript(`Heard: ${command}`);
      }
    }

    setTimeout(() => {
      setShowToast(false);
      setTranscript('');
    }, 3000);
  };

  if (!('webkitSpeechRecognition' in window)) {
    return null; // Not supported
  }

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-24 right-6 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4 z-50 transition-all">
          {isListening ? (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </div>
          ) : (
            <Mic size={16} className="text-slate-400" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{transcript || 'Speak now...'}</p>
          </div>
          <button onClick={() => setShowToast(false)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={toggleListening}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg text-white transition-all z-50 ${
          isListening 
            ? 'bg-orange-500 hover:bg-orange-600 scale-110 shadow-orange-500/30' 
            : 'bg-slate-900 hover:bg-slate-800'
        }`}
        aria-label="Voice Search"
      >
        <Mic size={24} />
      </button>
    </>
  );
}
