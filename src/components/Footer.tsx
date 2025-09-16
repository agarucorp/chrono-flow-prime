import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full bg-background/80 backdrop-blur border-t z-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-center text-xs text-muted-foreground">© Powered by AgaruCorp</p>
      </div>
    </footer>
  );
};
