import React from "react";

export interface GraphQLIconProps {
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function GraphQLIcon({
  size = 14,
  color = "#E10098",
  className,
  style,
}: GraphQLIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      {/* Outer regular hexagon */}
      <polygon
        points="12,2 21.5,7.5 21.5,18.5 12,24 2.5,18.5 2.5,7.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Hexagram triangle 1 */}
      <polygon
        points="12,2 21.5,18.5 2.5,18.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Hexagram triangle 2 */}
      <polygon
        points="12,24 21.5,7.5 2.5,7.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 6 Circular Vertex Nodes */}
      <circle cx="12" cy="2" r="1.75" fill={color} />
      <circle cx="21.5" cy="7.5" r="1.75" fill={color} />
      <circle cx="21.5" cy="18.5" r="1.75" fill={color} />
      <circle cx="12" cy="24" r="1.75" fill={color} />
      <circle cx="2.5" cy="18.5" r="1.75" fill={color} />
      <circle cx="2.5" cy="7.5" r="1.75" fill={color} />
    </svg>
  );
}
