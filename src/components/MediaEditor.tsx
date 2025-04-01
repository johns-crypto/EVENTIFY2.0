// src/components/MediaEditor.tsx
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper, { Area } from 'react-easy-crop';
import { FaTimes, FaCrop, FaEye, FaEyeSlash, FaCheck, FaUndo, FaRedo, FaSyncAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useSwipeable } from 'react-swipeable';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

// Interfaces
interface MediaEditorProps {
  mediaFile: File | null;
  setMediaFile: (file: File | null) => void;
  showMediaEditor: boolean;
  setShowMediaEditor: (show: boolean) => void;
  setOverlayText: (text: string) => void;
  setDescription: (text: string) => void;
  setVisibility: (visibility: 'private' | 'public') => void;
  overlayText: string;
  description: string;
  visibility: 'private' | 'public';
}

const MediaEditor: React.FC<MediaEditorProps> = ({
  mediaFile,
  setMediaFile,
  showMediaEditor,
  setShowMediaEditor,
  setOverlayText,
  setDescription,
  setVisibility,
  overlayText,
  description,
  visibility,
}) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // New: Rotation state
  const [flipHorizontal, setFlipHorizontal] = useState(false); // New: Flip horizontal state
  const [flipVertical, setFlipVertical] = useState(false); // New: Flip vertical state
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [isCropping, setIsCropping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false); // New: Toggle to show original media
  const modalRef = useRef<HTMLDivElement>(null);
  const initialStateRef = useRef({
    crop: { x: 0, y: 0 },
    zoom: 1,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });

  // Animation variants
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: 30 },
  };

  // Swipe handlers for mobile
  const swipeHandlers = useSwipeable({
    onSwipedDown: () => setShowMediaEditor(false),
    delta: 50,
  });

  // Load media file into a URL for preview
  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setMediaUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setMediaUrl(null);
    }
  }, [mediaFile]);

  // Focus management for accessibility
  useEffect(() => {
    if (showMediaEditor && modalRef.current) {
      modalRef.current.focus();
    }
  }, [showMediaEditor]);

  // Reset state when closing the editor
  const resetEditor = useCallback(() => {
    setCrop(initialStateRef.current.crop);
    setZoom(initialStateRef.current.zoom);
    setRotation(initialStateRef.current.rotation);
    setFlipHorizontal(initialStateRef.current.flipHorizontal);
    setFlipVertical(initialStateRef.current.flipVertical);
    setCroppedAreaPixels(null);
    setBrightness(initialStateRef.current.brightness);
    setContrast(initialStateRef.current.contrast);
    setSaturation(initialStateRef.current.saturation);
    setIsCropping(false);
    setShowPreview(false);
    setMediaUrl(null);
  }, []);

  // Handle crop completion
  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Get cropped image with transformations
  const getCroppedImage = useCallback(
    async (file: File, croppedAreaPixels: Area): Promise<File> => {
      const image = new Image();
      image.src = URL.createObjectURL(file);
      await new Promise((resolve) => (image.onload = resolve));

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      const { width, height, x, y } = croppedAreaPixels;

      // Set canvas dimensions to the cropped area
      canvas.width = width;
      canvas.height = height;

      // Apply transformations
      ctx.translate(width / 2, height / 2); // Move to center for rotation
      ctx.rotate((rotation * Math.PI) / 180); // Apply rotation
      ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1); // Apply flip
      ctx.translate(-width / 2, -height / 2); // Move back

      // Draw the cropped image
      ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], file.name, { type: file.type });
            resolve(croppedFile);
          }
        }, file.type);
      });
    },
    [rotation, flipHorizontal, flipVertical]
  );

  // Apply adjustments and save
  const saveMedia = useCallback(async () => {
    if (!mediaFile) return;

    setIsUploading(true);
    try {
      let finalFile = mediaFile;

      // Apply cropping if applicable
      if (isCropping && croppedAreaPixels) {
        finalFile = await getCroppedImage(mediaFile, croppedAreaPixels);
      }

      // Update the media file in the parent component
      setMediaFile(finalFile);

      // Update metadata
      setOverlayText(overlayText);
      setDescription(description);
      setVisibility(visibility);

      // Close the editor
      setShowMediaEditor(false);
      resetEditor();
      toast.success('Media saved successfully!');
    } catch (error) {
      toast.error(`Failed to save media: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  }, [
    mediaFile,
    isCropping,
    croppedAreaPixels,
    overlayText,
    description,
    visibility,
    setMediaFile,
    setOverlayText,
    setDescription,
    setVisibility,
    setShowMediaEditor,
    resetEditor,
    getCroppedImage,
  ]);

  // Reset all adjustments
  const resetAdjustments = useCallback(() => {
    setBrightness(initialStateRef.current.brightness);
    setContrast(initialStateRef.current.contrast);
    setSaturation(initialStateRef.current.saturation);
    setRotation(initialStateRef.current.rotation);
    setFlipHorizontal(initialStateRef.current.flipHorizontal);
    setFlipVertical(initialStateRef.current.flipVertical);
    setZoom(initialStateRef.current.zoom);
    setCrop(initialStateRef.current.crop);
    setCroppedAreaPixels(null);
    setIsCropping(false);
    setShowPreview(false);
  }, []);

  // Memoize the filter style to prevent unnecessary re-renders
  const filterStyle = useMemo(() => {
    return showPreview
      ? {}
      : {
          filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
          transform: `rotate(${rotation}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
        };
  }, [brightness, contrast, saturation, rotation, flipHorizontal, flipVertical, showPreview]);

  if (!showMediaEditor || !mediaFile) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={modalVariants}
        onClick={() => {
          setShowMediaEditor(false);
          resetEditor();
        }}
        {...swipeHandlers}
      >
        <motion.div
          ref={modalRef}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-800/90 backdrop-blur-lg rounded-2xl max-w-lg w-full mx-2 p-6 relative shadow-2xl border border-gray-700/50"
          role="dialog"
          aria-labelledby="media-editor-modal-title"
          tabIndex={-1}
        >
          {/* Close Button */}
          <motion.button
            type="button"
            onClick={() => {
              setShowMediaEditor(false);
              resetEditor();
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-yellow-400 transition-colors z-10"
            whileHover={{ scale: 1.2, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Close media editor"
          >
            <FaTimes size={20} />
          </motion.button>

          {/* Modal Title */}
          <motion.h2
            id="media-editor-modal-title"
            className="text-2xl font-bold text-yellow-400 mb-6 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Edit Media
          </motion.h2>

          {/* Media Preview */}
          <div className="relative w-full h-64 sm:h-80 rounded-lg overflow-hidden mb-6">
            {mediaUrl && (
              <>
                {mediaFile.type.startsWith('image') ? (
                  <>
                    {isCropping ? (
                      <Cropper
                        image={mediaUrl}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={4 / 3}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        classes={{
                          containerClassName: 'bg-gray-900',
                          mediaClassName: 'object-contain',
                          cropAreaClassName: 'border-2 border-yellow-400',
                        }}
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt="Media preview"
                        className="w-full h-full object-cover"
                        style={filterStyle} // Inline style required for dynamic CSS filters and transformations
                        loading="lazy"
                      />
                    )}
                  </>
                ) : (
                  <video src={mediaUrl} controls className="w-full h-full object-cover" />
                )}
                {overlayText && !isCropping && (
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <p className="text-white text-lg sm:text-xl font-semibold bg-black/50 rounded-lg p-2 text-center">
                      {overlayText}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Editing Controls */}
          <div className="space-y-6">
            {/* Crop and Preview Toggle */}
            {mediaFile.type.startsWith('image') && (
              <div className="flex flex-wrap gap-3">
                <motion.button
                  onClick={() => setIsCropping(!isCropping)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={isCropping ? 'Finish cropping' : 'Start cropping'}
                >
                  <FaCrop /> <span>{isCropping ? 'Finish Cropping' : 'Crop Image'}</span>
                </motion.button>
                <motion.button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={showPreview ? 'Hide original preview' : 'Show original preview'}
                >
                  {showPreview ? <FaEyeSlash /> : <FaEye />}
                  <span>{showPreview ? 'Hide Original' : 'Show Original'}</span>
                </motion.button>
              </div>
            )}

            {/* Zoom Slider (visible during cropping) */}
            {isCropping && (
              <div className="space-y-2">
                <label htmlFor="zoom-slider" className="text-sm text-gray-400">
                  Zoom
                </label>
                <Slider
                  id="zoom-slider"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(value) => setZoom(value as number)}
                  trackStyle={{ backgroundColor: '#facc15', height: 6 }}
                  handleStyle={{
                    borderColor: '#facc15',
                    height: 16,
                    width: 16,
                    marginTop: -5,
                    backgroundColor: '#fff',
                  }}
                  railStyle={{ backgroundColor: '#4b5563', height: 6 }}
                />
              </div>
            )}

            {/* Rotation and Flip Controls */}
            {mediaFile.type.startsWith('image') && !isCropping && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <motion.button
                    onClick={() => setRotation((prev) => prev - 90)}
                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Rotate left"
                  >
                    <FaUndo /> <span>Rotate Left</span>
                  </motion.button>
                  <motion.button
                    onClick={() => setRotation((prev) => prev + 90)}
                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Rotate right"
                  >
                    <FaRedo /> <span>Rotate Right</span>
                  </motion.button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <motion.button
                    onClick={() => setFlipHorizontal((prev) => !prev)}
                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Flip horizontal"
                  >
                    <FaSyncAlt /> <span>Flip Horizontal</span>
                  </motion.button>
                  <motion.button
                    onClick={() => setFlipVertical((prev) => !prev)}
                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Flip vertical"
                  >
                    <FaSyncAlt className="rotate-90" /> <span>Flip Vertical</span>
                  </motion.button>
                </div>
              </div>
            )}

            {/* Brightness, Contrast, Saturation Sliders */}
            {!isCropping && mediaFile.type.startsWith('image') && (
              <>
                <div className="space-y-2">
                  <label htmlFor="brightness-slider" className="text-sm text-gray-400">
                    Brightness
                  </label>
                  <Slider
                    id="brightness-slider"
                    min={0}
                    max={200}
                    value={brightness}
                    onChange={(value) => setBrightness(value as number)}
                    trackStyle={{ backgroundColor: '#facc15', height: 6 }}
                    handleStyle={{
                      borderColor: '#facc15',
                      height: 16,
                      width: 16,
                      marginTop: -5,
                      backgroundColor: '#fff',
                    }}
                    railStyle={{ backgroundColor: '#4b5563', height: 6 }}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contrast-slider" className="text-sm text-gray-400">
                    Contrast
                  </label>
                  <Slider
                    id="contrast-slider"
                    min={0}
                    max={200}
                    value={contrast}
                    onChange={(value) => setContrast(value as number)}
                    trackStyle={{ backgroundColor: '#facc15', height: 6 }}
                    handleStyle={{
                      borderColor: '#facc15',
                      height: 16,
                      width: 16,
                      marginTop: -5,
                      backgroundColor: '#fff',
                    }}
                    railStyle={{ backgroundColor: '#4b5563', height: 6 }}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="saturation-slider" className="text-sm text-gray-400">
                    Saturation
                  </label>
                  <Slider
                    id="saturation-slider"
                    min={0}
                    max={200}
                    value={saturation}
                    onChange={(value) => setSaturation(value as number)}
                    trackStyle={{ backgroundColor: '#facc15', height: 6 }}
                    handleStyle={{
                      borderColor: '#facc15',
                      height: 16,
                      width: 16,
                      marginTop: -5,
                      backgroundColor: '#fff',
                    }}
                    railStyle={{ backgroundColor: '#4b5563', height: 6 }}
                  />
                </div>
              </>
            )}

            {/* Overlay Text */}
            <div className="space-y-2">
              <label htmlFor="overlay-text" className="text-sm text-gray-400">
                Overlay Text
              </label>
              <input
                id="overlay-text"
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                placeholder="Add overlay text..."
                className="w-full p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm text-gray-400">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all resize-none text-sm sm:text-base"
                rows={3}
              />
            </div>

            {/* Visibility Toggle */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Visibility</label>
              <motion.button
                onClick={() => setVisibility(visibility === 'private' ? 'public' : 'private')}
                className="w-full flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={`Set visibility to ${visibility === 'private' ? 'public' : 'private'}`}
              >
                {visibility === 'private' ? <FaEyeSlash /> : <FaEye />}
                <span>{visibility === 'private' ? 'Private' : 'Public'}</span>
              </motion.button>
            </div>

            {/* Reset and Save Buttons */}
            <div className="flex flex-wrap gap-3">
              <motion.button
                onClick={resetAdjustments}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Reset adjustments"
              >
                <FaSyncAlt /> <span>Reset</span>
              </motion.button>
              <motion.button
                onClick={saveMedia}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base disabled:opacity-50"
                disabled={isUploading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Save media"
              >
                {isUploading ? (
                  <svg className="animate-spin h-5 w-5 text-gray-900" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      className="opacity-75"
                    />
                  </svg>
                ) : (
                  <>
                    <FaCheck /> <span>Save</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MediaEditor;