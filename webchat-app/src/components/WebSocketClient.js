"use client";

import { useState, useEffect } from "react";
import { getWebSocketUrl } from "@/lib/ip-config";

export default function WebSocketClient({ pageName }) {
  const [socket, setSocket] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [card, setCard] = useState("");
  const [receivedCard, setReceivedCard] = useState("");

  useEffect(() => {
    let ws;
    let cancelled = false;

    const connect = async () => {
      const url = await getWebSocketUrl(6789);
      if (cancelled) return;

      ws = new WebSocket(url);

      ws.onopen = () => console.log(`✅ Connected to WebSocket as ${pageName}`);

      ws.onmessage = (event) => {
        console.log("📩 Received from server:", event.data);
        const parsedData = JSON.parse(event.data);
        setMessages((prev) => [...prev, parsedData]);

        if (parsedData.card) {
          setReceivedCard(parsedData.card);
        }
      };

      ws.onclose = () => console.log("❌ Disconnected from WebSocket");
      ws.onerror = (error) => console.error("⚠️ WebSocket error:", error);

      setSocket(ws);
    };

    connect();

    return () => {
      cancelled = true;
      if (ws) {
        ws.close();
      }
    };
  }, [pageName]);

  const sendMessage = () => {
    if (socket && message.trim()) {
      const msgObj = { page: pageName, message, card: "" };
      console.log("📤 Sending:", msgObj);
      socket.send(JSON.stringify(msgObj));
      setMessage("");
    }
  };

  const sendCard = () => {
    if (socket && card.trim().match(/^[A23456789TJQK][SDCH]$/)) {
      const msgObj = { page: pageName, message: "", card };
      console.log("🃏 Sending card:", msgObj);
      socket.send(JSON.stringify(msgObj));
      setReceivedCard(card);
      setCard("");
    } else {
      alert("❌ Invalid card format. Use format: AS, 7D, KH, etc.");
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-lg">
      <h2 className="text-lg font-bold">WebSocket Chat - {pageName}</h2>

      {/* Message Input */}
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="border p-2 rounded w-full"
      />
      <button onClick={sendMessage} className="bg-blue-500 text-white p-2 mt-2 rounded">
        Send
      </button>

      {/* Card Input */}
      <input
        type="text"
        value={card}
        onChange={(e) => setCard(e.target.value.toUpperCase())}
        placeholder="Enter card (AS, 7D, KH...)"
        className="border p-2 rounded w-full mt-4"
      />
      <button onClick={sendCard} className="bg-green-500 text-white p-2 mt-2 rounded">
        Show Card
      </button>

      {/* Display Messages */}
      <h3 className="mt-4 font-semibold">Messages:</h3>
      <ul className="mt-2">
        {messages.map((msg, index) => (
          <li key={index} className="border p-2 my-1 rounded bg-gray-100">
            <strong>{msg.sender}:</strong> {msg.message}
          </li>
        ))}
      </ul>

      {/* Display Card Image */}
      {receivedCard && (
        <div className="mt-4">
          <h3 className="font-semibold">Selected Card:</h3>
          <img
            src={`/cards/${receivedCard}.png`}
            alt={`Card ${receivedCard}`}
            className="w-24 h-36 border rounded mt-2"
          />
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";

export default function WebSocketClient({ pageName }) {
  const [socket, setSocket] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [card, setCard] = useState("");
  const [receivedCard, setReceivedCard] = useState("");

  useEffect(() => {
    let ws;
    let cancelled = false;

    const connect = async () => {
      const url = await getWebSocketUrl(6789);
      if (cancelled) return;

      ws = new WebSocket(url);

      ws.onopen = () => console.log(`✅ Connected to WebSocket as ${pageName}`);

      ws.onmessage = (event) => {
        console.log("📩 Received from server:", event.data);
        const parsedData = JSON.parse(event.data);
        setMessages((prev) => [...prev, parsedData]);

        if (parsedData.card) {
          setReceivedCard(parsedData.card);
        }
      };

      ws.onclose = () => console.log("❌ Disconnected from WebSocket");
      ws.onerror = (error) => console.error("⚠️ WebSocket error:", error);

      setSocket(ws);
    };

    connect();

    return () => {
      cancelled = true;
      if (ws) {
        ws.close();
      }
    };
  }, [pageName]);

  const sendMessage = () => {
    if (socket && message.trim()) {
      const msgObj = { page: pageName, message, card: "" };
      console.log("📤 Sending:", msgObj);
      socket.send(JSON.stringify(msgObj));
      setMessage("");
    }
  };

  const sendCard = () => {
    if (socket && card.trim().match(/^[A23456789TJQK][SDCH]$/)) {
      const msgObj = { page: pageName, message: "", card };
      console.log("🃏 Sending card:", msgObj);
      socket.send(JSON.stringify(msgObj));
      setReceivedCard(card);
      setCard("");
    } else {
      alert("❌ Invalid card format. Use format: AS, 7D, KH, etc.");
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-lg">
      <h2 className="text-lg font-bold">WebSocket Chat - {pageName}</h2>

      {/* Message Input */}
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="border p-2 rounded w-full"
      />
      <button onClick={sendMessage} className="bg-blue-500 text-white p-2 mt-2 rounded">
        Send
      </button>

      {/* Card Input */}
      <input
        type="text"
        value={card}
        onChange={(e) => setCard(e.target.value.toUpperCase())}
        placeholder="Enter card (AS, 7D, KH...)"
        className="border p-2 rounded w-full mt-4"
      />
      <button onClick={sendCard} className="bg-green-500 text-white p-2 mt-2 rounded">
        Show Card
      </button>

      {/* Display Messages */}
      <h3 className="mt-4 font-semibold">Messages:</h3>
      <ul className="mt-2">
        {messages.map((msg, index) => (
          <li key={index} className="border p-2 my-1 rounded bg-gray-100">
            <strong>{msg.sender}:</strong> {msg.message}
          </li>
        ))}
      </ul>

      {/* Display Card Image */}
      {receivedCard && (
        <div className="mt-4">
          <h3 className="font-semibold">Selected Card:</h3>
          <img
            src={`/cards/${receivedCard}.png`}
            alt={`Card ${receivedCard}`}
            className="w-24 h-36 border rounded mt-2"
          />
        </div>
      )}
    </div>
  );
}
