import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-background/80 backdrop-blur border-t mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2">
          <p className="text-center text-xs text-muted-foreground">© Powered by</p>
          <a 
            href="https://www.agarucorp.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block"
          >
            <img 
              src="/agarucorp-logo.svg" 
              alt="AgaruCorp" 
              className="h-[17px] w-auto sm:h-6 md:h-7 opacity-70 hover:opacity-100 transition-opacity"
              style={{ maxWidth: '120px' }}
              onError={(e) => {
                console.error('Error loading logo:', e);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
};
