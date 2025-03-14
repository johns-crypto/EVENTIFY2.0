import { useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { motion } from 'framer-motion';
import { FaCrop, FaSave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function MediaEditor() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setSrc(url);
      if (selectedFile.type.startsWith('video') && videoRef.current) {
        videoRef.current.onloadedmetadata = () => setTrimEnd(videoRef.current?.duration || 0);
      }
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgRef(e.currentTarget);
  };

  const handleCropChange = (_: PixelCrop, percentCrop: Crop) => {
    setCrop(percentCrop);
  };

  const handleCropComplete = (crop: PixelCrop) => {
    setCompletedCrop(crop);
  };

  const saveMedia = async () => {
    if (!file || (!completedCrop && !file.type.startsWith('video'))) {
      toast.error('Please upload a file and complete editing.');
      return;
    }

    setLoading(true);
    try {
      const isVideo = file.type.startsWith('video');
      const storagePath = `editedMedia/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      if (isVideo) {
        // Note: Trimming requires server-side processing (e.g., FFmpeg), not implemented here
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        toast.success('Video saved (trimming not applied - requires server-side processing)!');
        navigate('/chat');
        return url;
      }

      if (!imgRef || !completedCrop) {
        throw new Error('Image reference or crop data missing.');
      }

      const canvas = document.createElement('canvas');
      const scaleX = imgRef.naturalWidth / imgRef.width;
      const scaleY = imgRef.naturalHeight / imgRef.height;
      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.filter = filter;
      ctx.drawImage(
        imgRef,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      if (text) {
        ctx.font = '30px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(text, 20, 50);
      }

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg'));
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      toast.success('Image saved!');
      navigate('/chat');
      return url;
    } catch (error: any) {
      toast.error('Failed to save media: ' + error.message);
      console.error('Error saving media:', error);
    } finally {
      setLoading(false);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray py-12 px-4 sm:px-6 lg:px-8">
      <motion.div className="max-w-6xl mx-auto flex" initial="hidden" animate="visible" variants={fadeIn}>
        <div className="w-1/4 bg-primary-navy p-6 rounded-l-lg shadow-lg">
          <h2 className="text-xl font-semibold text-accent-gold mb-4">Tools</h2>
          {!file?.type.startsWith('video') && (
            <>
              <button
                className="w-full p-2 mb-2 bg-secondary-deepRed text-neutral-lightGray rounded hover:bg-secondary-darkRed flex items-center justify-center"
                aria-label="Crop Tool"
              >
                <FaCrop size={20} className="mr-2" /> Crop
              </button>
              <div className="mb-2">
                <label htmlFor="filterSelect" className="block text-sm text-neutral-lightGray mb-1">
                  Filter
                </label>
                <select
                  id="filterSelect"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full p-2 bg-secondary-deepRed text-neutral-lightGray rounded"
                >
                  <option value="">No Filter</option>
                  <option value="grayscale(100%)">Grayscale</option>
                  <option value="sepia(100%)">Sepia</option>
                  <option value="blur(5px)">Blur</option>
                </select>
              </div>
              <div className="mb-2">
                <label htmlFor="textInput" className="block text-sm text-neutral-lightGray mb-1">
                  Add Text
                </label>
                <input
                  id="textInput"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text"
                  className="w-full p-2 bg-secondary-deepRed text-neutral-lightGray rounded"
                />
              </div>
            </>
          )}
          {file?.type.startsWith('video') && (
            <>
              <div className="mb-2">
                <label htmlFor="trimStart" className="block text-sm text-neutral-lightGray mb-1">
                  Trim Start (s)
                </label>
                <input
                  id="trimStart"
                  type="number"
                  value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  placeholder="Start (s)"
                  className="w-full p-2 bg-secondary-deepRed text-neutral-lightGray rounded"
                  min={0}
                />
              </div>
              <div className="mb-2">
                <label htmlFor="trimEnd" className="block text-sm text-neutral-lightGray mb-1">
                  Trim End (s)
                </label>
                <input
                  id="trimEnd"
                  type="number"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                  placeholder="End (s)"
                  className="w-full p-2 bg-secondary-deepRed text-neutral-lightGray rounded"
                  min={trimStart}
                />
              </div>
            </>
          )}
          <button
            onClick={saveMedia}
            className="w-full p-2 bg-accent-gold text-neutral-darkGray rounded hover:bg-yellow-600 flex items-center justify-center disabled:opacity-50"
            disabled={!file || loading}
            aria-label="Save Media"
          >
            <FaSave size={20} className="mr-2" />
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="flex-1 bg-primary-navy p-6 rounded-r-lg shadow-lg">
          <h1 className="text-3xl font-bold text-accent-gold mb-6">Media Editor</h1>
          <div className="mb-4">
            <label htmlFor="fileInput" className="block text-sm text-neutral-lightGray mb-1">
              Upload Media
            </label>
            <input
              id="fileInput"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="w-full p-2 text-neutral-lightGray bg-neutral-offWhite rounded"
              disabled={loading}
            />
          </div>
          {src && (
            file.type.startsWith('video') ? (
              <video
                ref={videoRef}
                src={src}
                controls
                className="max-w-full h-auto rounded"
                onLoadedMetadata={() => setTrimEnd(videoRef.current?.duration || 0)}
              />
            ) : (
              <ReactCrop
                crop={crop}
                onChange={handleCropChange}
                onComplete={handleCropComplete}
                aspect={1}
              >
                <img
                  src={src}
                  onLoad={onImageLoad}
                  alt="Editable media"
                  className="max-w-full h-auto"
                  style={{ filter }} // Kept for filter preview, consider moving to CSS if expanded
                />
              </ReactCrop>
            )
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default MediaEditor;