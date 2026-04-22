/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

/**
 * Formats conversation messages into a Markdown string.
 * @param {string} title - The title of the conversation.
 * @param {Array} messages - The list of messages in the conversation.
 * @returns {string} The formatted Markdown string.
 */
export function formatToMarkdown(title, messages) {
  let markdown = `# ${title}

`;
  
  messages.forEach((msg) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    markdown += `**${role}:** ${msg.content}

`;
  });
  
  return markdown;
}

/**
 * Formats conversation messages into a Plain Text string.
 * @param {Array} messages - The list of messages in the conversation.
 * @returns {string} The formatted Plain Text string.
 */
export function formatToText(messages) {
  let text = '';
  
  messages.forEach((msg) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    text += `${role}: ${msg.content}
`;
  });
  
  return text;
}

/**
 * Triggers a browser download for a given content and filename.
 * @param {string} content - The content of the file.
 * @param {string} filename - The name of the file to be downloaded.
 * @param {string} mimeType - The MIME type of the file.
 */
export function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
