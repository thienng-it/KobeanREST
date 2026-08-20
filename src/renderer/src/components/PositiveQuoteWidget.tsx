import { useState, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { getRandomPositiveQuote, type PositiveQuote } from "../services/quotes";

export function PositiveQuoteWidget() {
  const [quote, setQuote] = useState<PositiveQuote>(() => getRandomPositiveQuote());
  const [isRotating, setIsRotating] = useState(false);

  const handleNextQuote = useCallback(() => {
    setIsRotating(true);
    setQuote(getRandomPositiveQuote());
    setTimeout(() => setIsRotating(false), 400);
  }, []);

  return (
    <div className="positive-quote-widget-wrapper">
      <div
        className="positive-quote-pill"
        onClick={handleNextQuote}
        title={`“${quote.quote}” — ${quote.author}\n\n(Click to get a new quote ✨)`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleNextQuote();
          }
        }}
      >
        <span className="quote-emoji">{quote.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="quote-text">“{quote.quote}”</div>
          <div className="quote-author">— {quote.author}</div>
        </div>
        <button
          type="button"
          className="quote-pill-refresh-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleNextQuote();
          }}
          title="Get next quote"
          aria-label="Refresh quote"
        >
          <RefreshCw
            size={11}
            className={`quote-refresh-icon ${isRotating ? "rotating" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}

export function PositiveQuoteCard() {
  const [quote, setQuote] = useState<PositiveQuote>(() => getRandomPositiveQuote());
  const [isRotating, setIsRotating] = useState(false);

  const handleNextQuote = useCallback(() => {
    setIsRotating(true);
    setQuote(getRandomPositiveQuote());
    setTimeout(() => setIsRotating(false), 400);
  }, []);

  return (
    <div className="positive-quote-hero-card">
      <div className="quote-hero-header">
        <div className="quote-hero-title">
          <Sparkles size={14} className="sparkle-icon" />
          <span>Daily Dev Spark</span>
        </div>
        <button
          type="button"
          className="quote-hero-refresh-btn"
          onClick={handleNextQuote}
          title="Get another quote"
          aria-label="Refresh quote"
        >
          <RefreshCw size={12} className={isRotating ? "rotating" : ""} />
        </button>
      </div>
      <div className="quote-hero-body">
        <span className="quote-hero-emoji">{quote.emoji}</span>
        <blockquote className="quote-hero-quote">“{quote.quote}”</blockquote>
        <div className="quote-hero-author">— {quote.author}</div>
      </div>
    </div>
  );
}
