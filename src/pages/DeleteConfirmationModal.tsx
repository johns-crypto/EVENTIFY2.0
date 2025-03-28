// src/pages/DeleteConfirmationModal.tsx
import { motion } from 'framer-motion';

interface DeleteConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmationModal({ title, message, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800/90 backdrop-blur-md rounded-2xl max-w-md w-full p-4 sm:p-6 lg:p-8 relative border border-gray-700/30 shadow-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <h3 className="text-lg sm:text-xl font-bold text-yellow-400 mb-4">{title}</h3>
        <p className="text-gray-300 mb-6 text-sm sm:text-base">{message}</p>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onConfirm}
            className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-400 hover:to-red-500 transition-all font-semibold shadow-sm hover:shadow-md text-sm sm:text-base"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-gray-600/50 text-gray-200 rounded-full hover:bg-gray-500/50 transition-all font-semibold shadow-sm hover:shadow-md text-sm sm:text-base"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default DeleteConfirmationModal;