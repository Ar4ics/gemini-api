import React, {useCallback, useState} from "react";
import {IconButton, List, ListItem} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplayIcon from "@mui/icons-material/Replay";
import DeleteIcon from "@mui/icons-material/Delete";
import {ChatMessage} from "./ChatMessage";
import Message from "./Message";

// const P: React.FC<{}> = memo(({}) => {
//   console.log('messages');
//   return <>c</>;
// }, (a, b) => true);

const Messages: React.FC<{
  messages: ChatMessage[],
  loading: boolean,
  handleReplay: (role: 'user' | 'model') => Promise<void>,
  handleDelete: () => void,
}> = ({ messages, loading, handleReplay, handleDelete }) => {
  console.log('messages count', messages.length);

  const handleCopy = useCallback((content: string | any) => {
    const text = typeof content === 'string' ? content : content.props?.children;
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log('copy ok');
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
      });
  }, []);

  // This ref will be attached to the last item of the list.
  // const bottomListElementRef = useRef<HTMLDivElement>(null);

  // Whenever items change, we'll scroll to the last item.
  // useEffect(() => {
  //   if (bottomListElementRef.current) {
  //     bottomListElementRef.current.scrollIntoView();
  //   }
  // }, [messages]);

  const [hover, setHover] = useState<number | null>(null);

  // return <>
  //   {messages.map((message) => (
  //     <P key={message.id}/>
  //   ))}
  // </>

  return (
    <List
      disablePadding={true}
    >
      {messages.map((message, index) => (
        <ListItem
          onMouseOver={() => setHover(index)}
          onMouseLeave={() => setHover(null)}
          disablePadding={true}
          style={{position: 'relative'}}
          key={index}
        >
          <Message message={message.parts} role={message.role} handleCopy={handleCopy}/>
          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              zIndex: 10,
            }}
          >
            {hover === index && !loading && (
              <IconButton onClick={() => handleCopy(message.parts)}>
                <ContentCopyIcon/>
              </IconButton>
            )}
            {hover === index && !loading && index === messages.length - 1 && (
              <>
                <IconButton onClick={() => handleReplay(message.role)}>
                  <ReplayIcon/>
                </IconButton>
                <IconButton onClick={() => handleDelete()}>
                  <DeleteIcon/>
                </IconButton>
              </>
            )}
          </div>
        </ListItem>
      ))}
    </List>
  );
}

export default Messages;