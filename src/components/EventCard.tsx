import { memo } from 'react';
import { motion } from 'framer-motion';
import { NormalizedEventData } from '../types'; // Updated import

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

interface EventCardProps {
  event: NormalizedEventData; // Updated to NormalizedEventData
  defaultEventImage: string;
}

const EventCard = memo(({ event, defaultEventImage }: EventCardProps) => {
  return (
    <motion.div
      className="relative h-72 sm:h-80 bg-gray-700/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300"
      variants={fadeIn}
      whileTap={{ scale: 0.98 }}
    >
      <img
        src={event.image || defaultEventImage}
        alt={event.title}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => (e.currentTarget.src = defaultEventImage)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3 sm:p-4 text-white">
        <motion.h3
          className="text-base sm:text-xl font-semibold line-clamp-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {event.title}
        </motion.h3>
        <motion.p
          className="text-xs sm:text-sm mt-1 line-clamp-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {new Date(event.date || event.createdAt).toLocaleDateString()}
        </motion.p>
        <motion.p
          className="text-xs sm:text-sm line-clamp-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          {event.location || 'Location TBD'}
        </motion.p>
        <motion.a
          href={`/events/${event.id}`}
          className="mt-2 inline-block bg-red-600 text-white px-3 sm:px-4 py-1 sm:py-1 rounded-full hover:bg-red-500 transition-all text-xs sm:text-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          whileTap={{ scale: 0.95 }}
        >
          Learn More
        </motion.a>
      </div>
    </motion.div>
  );
});

export default EventCard;