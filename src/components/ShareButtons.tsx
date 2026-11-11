'use client';
import { useState } from 'react';

// Viewer-side sharing: Facebook + copy link
export default function ShareButtons() {
  const [copied, setCopied] = useState(false);

  function shareFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      'fb-share',
      'width=600,height=500'
    );
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="actions">
      <button className="btn fb" onClick={shareFacebook}>Share on Facebook</button>
      <button className="btn gray" onClick={copyLink}>{copied ? 'Link copied!' : 'Copy link'}</button>
    </div>
  );
}
