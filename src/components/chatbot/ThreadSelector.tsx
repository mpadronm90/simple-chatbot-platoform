import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentThread, Thread } from '../../store/threadsSlice';
import { RootState } from '../../store';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface ThreadSelectorProps {
  chatbotId: string;
  userId: string;
  adminId: string;
}

const ThreadSelector: React.FC<ThreadSelectorProps> = ({ chatbotId, userId, adminId }) => {
  const dispatch = useDispatch();
  const threads = useSelector((state: RootState) => state.threads.threads);

  useEffect(() => {
    const fetchThreads = async () => {
      const q = query(
        collection(db, 'threads'),
        where('chatbotId', '==', chatbotId),
        where('userId', '==', userId),
        where('adminId', '==', adminId)
      );
      const querySnapshot = await getDocs(q);
      const fetchedThreads = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        chatbotId,
        userId,
        adminId,
        messages: (doc.data().messages || []).map((msg: any) => ({
          id: msg.id,
          object: 'message',
          created: Number(msg.created),
          role: msg.role,
          content: msg.content || '',
          content_type: msg.content_type,
          metadata: msg.metadata
        }))
      })) as Thread[];
      dispatch(setCurrentThread(fetchedThreads[0] || null));
    };

    fetchThreads();
  }, [chatbotId, userId, adminId, dispatch]);

  return (
    <div className="thread-selector">
      <h3>Select a Thread</h3>
      <ul>
        {threads.map(thread => (
          <li key={thread.id} onClick={() => dispatch(setCurrentThread(thread))}>
            {thread.id}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ThreadSelector;
