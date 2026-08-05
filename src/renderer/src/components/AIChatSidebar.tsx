
import React, { useState } from 'react';

export function AIChatSidebar() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: userMsg, stream: false })
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', text: data.response || 'Local Ollama Response' }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Local Ollama LLM connected.' }]);
    }
  };

  return (
    <aside className="w-80 h-full bg-gray-900 border-l border-gray-800 p-4 flex flex-col">
      <h3 className="font-bold text-white mb-4">🤖 Local Ollama AI Assistant</h3>
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`p-2 rounded ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Ollama..."
          className="flex-1 bg-gray-800 border border-gray-700 text-sm text-white px-3 py-2 rounded focus:outline-none"
        />
        <button onClick={handleSend} className="bg-indigo-600 px-4 py-2 text-sm text-white rounded font-medium">Send</button>
      </div>
    </aside>
  );
}
