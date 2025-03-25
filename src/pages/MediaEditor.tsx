import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { useSwipeable } from 'react-swipeable';
import Cropper from 'react-easy-crop';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { toast } from 'react-toastify';

interface MediaEdits {
  brightness: number;
  contrast: number;
  saturation: number;
}

interface MediaEditorProps {
  mediaFile: File | null;
  setMediaFile: (file: File | null) => void;
  showMediaEditor: boolean;
  setShowMediaEditor: (show: boolean) => void;
  setOverlayText: (text: string) => void;
  setDescription: (description: string) => void;
  setVisibility: (visibility: 'private' | 'public') => void;
  overlayText: string;
  description: string;
  visibility: 'private' | 'public';
}

function MediaEditor({
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
}: MediaEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [mediaEdits, setMediaEdits] = useState<MediaEdits>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });

  const onCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const getCroppedImg = useCallback(async () => {
    if (!croppedAreaPixels || !mediaFile) {
      throw new Error('Cropped area or media file is not defined');
    }
    const canvas = document.createElement('canvas');
    const image = new Image();
    image.src = URL.createObjectURL(mediaFile);
    await new Promise((resolve) => (image.onload = resolve));
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
    }
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg'));
  }, [croppedAreaPixels, mediaFile]);

  const applyMediaEdits = useCallback(async () => {
    try {
      const croppedBlob = await getCroppedImg();
      if (croppedBlob) {
        const croppedFile = new File([croppedBlob as Blob], 'cropped.jpg', {
          type: 'image/jpeg',
        });
        setMediaFile(croppedFile);
        toast.success('Media edits applied successfully.');
      }
    } catch (err) {
      toast.error(`Failed to apply edits: ${(err as Error).message}`);
    }
  }, [getCroppedImg, setMediaFile]);

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  const mediaEditorHandlers = useSwipeable({
    onSwipedDown: () => setShowMediaEditor(false),
    delta: 50,
  });

  return (
    <AnimatePresence>
      {showMediaEditor && mediaFile && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalVariants}
          {...mediaEditorHandlers}
        >
          <div className="modal media-editor-modal">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Edit Media</h2>
              <motion.button
                onClick={() => setShowMediaEditor(false)}
                className="text-neutral-lightGray"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close media editor"
              >
                <FaTimes size={20} />
              </motion.button>
            </div>
            <div className="cropper-container">
              <Cropper
                image={mediaFile ? URL.createObjectURL(mediaFile) : ''}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                classes={{ mediaClassName: 'cropper-image' }}
              />
            </div>
            <div className="slider-container">
              <label className="block text-sm mb-1" htmlFor="zoom-slider">
                Zoom
              </label>
              <Slider
                id="zoom-slider"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(value: number | number[]) =>
                  setZoom(Array.isArray(value) ? value[0] : value)
                }
                aria-label="Adjust zoom"
              />
            </div>
            <div className="slider-container">
              <label className="block text-sm mb-1" htmlFor="brightness-slider">
                Brightness
              </label>
              <Slider
                id="brightness-slider"
                min={0}
                max={200}
                value={mediaEdits.brightness}
                onChange={(value: number | number[]) =>
                  setMediaEdits((prev) => ({
                    ...prev,
                    brightness: Array.isArray(value) ? value[0] : value,
                  }))
                }
                aria-label="Adjust brightness"
              />
            </div>
            <div className="slider-container">
              <label className="block text-sm mb-1" htmlFor="contrast-slider">
                Contrast
              </label>
              <Slider
                id="contrast-slider"
                min={0}
                max={200}
                value={mediaEdits.contrast}
                onChange={(value: number | number[]) =>
                  setMediaEdits((prev) => ({
                    ...prev,
                    contrast: Array.isArray(value) ? value[0] : value,
                  }))
                }
                aria-label="Adjust contrast"
              />
            </div>
            <div className="slider-container">
              <label className="block text-sm mb-1" htmlFor="saturation-slider">
                Saturation
              </label>
              <Slider
                id="saturation-slider"
                min={0}
                max={200}
                value={mediaEdits.saturation}
                onChange={(value: number | number[]) =>
                  setMediaEdits((prev) => ({
                    ...prev,
                    saturation: Array.isArray(value) ? value[0] : value,
                  }))
                }
                aria-label="Adjust saturation"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1" htmlFor="overlay-text">
                Overlay Text
              </label>
              <input
                id="overlay-text"
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                placeholder="Add overlay text..."
                className="input w-full"
                aria-label="Add overlay text"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                className="textarea w-full"
                rows={3}
                aria-label="Add a description"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1" htmlFor="visibility">
                Visibility
              </label>
              <select
                id="visibility"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as 'private' | 'public')
                }
                className="select w-full"
                aria-label="Select visibility"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1">Preview</label>
              <img
                src={mediaFile ? URL.createObjectURL(mediaFile) : ''}
                alt="Media preview"
                className="media-preview"
                style={
                  {
                    '--brightness': `${mediaEdits.brightness}%`,
                    '--contrast': `${mediaEdits.contrast}%`,
                    '--saturation': `${mediaEdits.saturation}%`,
                  } as React.CSSProperties
                }
              />
              {overlayText && (
                <p className="font-semibold text-center mt-2">{overlayText}</p>
              )}
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={applyMediaEdits}
                className="button button-primary flex-1"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Apply media edits"
              >
                Apply Edits
              </motion.button>
              <motion.button
                onClick={() => {
                  setMediaFile(null);
                  setShowMediaEditor(false);
                }}
                className="button button-secondary flex-1"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Cancel media edits"
              >
                Cancel
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default MediaEditor;