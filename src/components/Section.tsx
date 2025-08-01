// Section.js
import React from 'react';

interface SectionProps {
  title: string;
}

function Section({ title }: SectionProps) {
  return (
    <div>
      <h3>{title}</h3>
      {/* TODO: List documents within this section */}
    </div>
  );
}

export default Section;