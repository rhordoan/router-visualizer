'use client';

import React from 'react';

interface ScrollingSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  suggestions?: string[];
  useThreeRows?: boolean; // New prop to control 3-row layout for welcome screen
}

const defaultSuggestions = [
  "What healthcare services are available?",
  "Tell me about patient care programs",
  "How does the healthcare system work?",
  "What are telehealth services?",
  "How to access medical records?",
  "Explain health insurance coverage",
  "What are preventive care services?",
  "How can I find a specialist?",
  "What emergency services are available?",
  "Explain prescription drug programs",
  "What mental health services exist?",
  "How does hospital admission work?",
];

interface ScrollRowProps {
  items: string[];
  speed: number;
  rowId: string;
  onSuggestionClick: (suggestion: string) => void;
}

function ScrollRow({ items, speed, rowId, onSuggestionClick }: ScrollRowProps) {
  return (
    <div className="suggestions-container">
      <div className="suggestion-track">
        {/* First scrolling group */}
        <div 
          className="suggestion-group"
          style={{
            animation: `scrollLeft ${speed}s linear infinite`
          }}
        >
          {items.map((suggestion, idx) => (
            <div
              key={`${rowId}-group1-${idx}`}
              className="suggestion-chip"
              onClick={() => onSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
        
        {/* Second scrolling group (duplicate) */}
        <div 
          className="suggestion-group"
          style={{
            animation: `scrollLeft ${speed}s linear infinite`
          }}
          aria-hidden="true"
        >
          {items.map((suggestion, idx) => (
            <div
              key={`${rowId}-group2-${idx}`}
              className="suggestion-chip"
              onClick={() => onSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScrollingSuggestions({ onSuggestionClick, suggestions, useThreeRows = false }: ScrollingSuggestionsProps) {
  // Use provided suggestions or defaults
  const displaySuggestions = suggestions || defaultSuggestions;
  
  // Split suggestions based on layout
  if (useThreeRows) {
    // 3-row layout for welcome screen
    const perRow = Math.ceil(displaySuggestions.length / 3);
    const row1 = displaySuggestions.slice(0, perRow);
    const row2 = displaySuggestions.slice(perRow, perRow * 2);
    const row3 = displaySuggestions.slice(perRow * 2);

    return (
      <div className="w-full max-w-5xl mx-auto space-y-4">
        <ScrollRow
          items={row1}
          speed={40}
          rowId="row1"
          onSuggestionClick={onSuggestionClick}
        />
        <ScrollRow
          items={row2}
          speed={50}
          rowId="row2"
          onSuggestionClick={onSuggestionClick}
        />
        <ScrollRow
          items={row3}
          speed={60}
          rowId="row3"
          onSuggestionClick={onSuggestionClick}
        />
      </div>
    );
  } else {
    // 1-row layout for dynamic suggestions (medium speed between row1 and row2)
    return (
      <div className="w-full max-w-5xl mx-auto">
        <ScrollRow
          items={displaySuggestions}
          speed={65}
          rowId="dynamic-row"
          onSuggestionClick={onSuggestionClick}
        />
      </div>
    );
  }
}

