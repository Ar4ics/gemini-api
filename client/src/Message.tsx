import React from "react";
import {IconButton, ListItemText} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import * as Themes from "react-syntax-highlighter/dist/esm/styles/prism";

type MessageProps = {
  message: string,
  role: string,
  handleCopy: (content: string | any) => void,
}

const Message: React.FC<MessageProps> = React.memo(({ message, role, handleCopy }) => {
  // console.log('message', message);
  console.log('message rendered');

  return (
    <ListItemText
      primary={<Markdown
        className="reactMarkDown"
        remarkPlugins={[remarkGfm]}
        children={message}
        components={{
          pre(props) {
            const {children} = props;
            return (
              <pre style={{position: 'relative'}}>
                <IconButton
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    zIndex: 10,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleCopy(children)}
                >
                  <ContentCopyIcon />
                </IconButton>
                {children}
              </pre>
            );
          },
          code(props) {
            const {children, className, node, ...rest} = props
            const match = /language-(\w+)/.exec(className || '')
            return match ? (
              <SyntaxHighlighter
                //{...rest}
                PreTag="div"
                children={String(children).replace(/\n$/, '')}
                language={match[1]}
                style={Themes.oneDark}
              />
            ) : (
              <code {...rest} className={className}>
                {children}
              </code>
            )
          }
        }}
      />
      }
      secondary={role === 'user' ? 'Вы' : 'GPT'}/>
  );
});

export default Message;