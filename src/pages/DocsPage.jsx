import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkSlug from 'remark-slug';

const DocsPage = () => {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    fetch('/RAFFLHUB_PROTOCOL_DOCUMENTATION.md')
      .then((res) => res.text())
      .then(setMarkdown);
  }, []);

  return (
    <div className="prose prose-lg dark:prose-invert mx-auto p-6 max-w-5xl bg-card rounded-xl shadow-md border mt-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-primary">Rafflhub Protocol Documentation</h1>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSlug]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 text-primary" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-6 mb-3 text-blue-700 dark:text-blue-300" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2 text-blue-600 dark:text-blue-200" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-4" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-4" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          code: ({node, ...props}) => <code className="bg-muted px-1 py-0.5 rounded text-sm text-pink-600 dark:text-pink-400" {...props} />,
          pre: ({node, ...props}) => <pre className="bg-muted p-4 rounded mb-4 overflow-x-auto" {...props} />,
          a: ({href, ...props}) =>
            href && href.startsWith('#') ? (
              <a className="text-blue-600 underline hover:text-blue-800" {...props} href={href} />
            ) : (
              <a className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer" {...props} href={href} />
            ),
          table: ({node, ...props}) => <table className="table-auto border-collapse w-full my-4" {...props} />,
          th: ({node, ...props}) => <th className="border px-4 py-2 bg-muted font-semibold" {...props} />,
          td: ({node, ...props}) => <td className="border px-4 py-2" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default DocsPage; 