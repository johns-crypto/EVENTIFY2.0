import { Timestamp } from 'firebase/firestore';
import { EventData, NormalizedEventData, Comment, NormalizedComment } from '../types';

export const normalizeEventData = (event: EventData): NormalizedEventData => {
  return {
    ...event,
    createdAt: event.createdAt instanceof Timestamp ? event.createdAt.toDate().toISOString() : event.createdAt,
    date: event.date instanceof Timestamp ? event.date.toDate().toISOString() : event.date || '',
  };
};

export const normalizeComment = (comment: Comment): NormalizedComment => {
  return {
    ...comment,
    createdAt:
      comment.createdAt instanceof Timestamp
        ? comment.createdAt.toDate().toISOString()
        : comment.createdAt,
  };
};