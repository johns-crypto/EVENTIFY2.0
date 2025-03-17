import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll } from 'framer-motion';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { FaUserCircle, FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaArrowUp } from 'react-icons/fa';

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerChildren = {
  hidden: { opacity: 0 },
  visible: { transition: { staggerChildren: 0.2 } },
};

const headingFade = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut', type: 'spring', bounce: 0.3 },
  },
};

const cardFlip = {
  front: { rotateY: 0, transition: { duration: 0.6 } },
  back: { rotateY: 180, transition: { duration: 0.6 } },
};

function About() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Scroll animations for sections
  const { scrollY } = useScroll();

  useEffect(() => {
    const handleScroll = () => {
      if (scrollY.get() > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    scrollY.on('change', handleScroll);
    return () => scrollY.clearListeners();
  }, [scrollY]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Form validation
  const validateForm = () => {
    const errors = { name: '', email: '', message: '' };
    let isValid = true;

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
      isValid = false;
    }
    if (!formData.message.trim()) {
      errors.message = 'Message is required';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Validate on change
    validateForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, 'contactMessages'), {
        ...formData,
        timestamp: new Date().toISOString(),
      });
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
      setFormErrors({ name: '', email: '', message: '' });
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      setError('Failed to send message. Try again later.');
      console.error('Error submitting form:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialClick = (platform: string) => {
    console.log(`Social media link clicked: ${platform}`);
    // Here you can add analytics tracking (e.g., Google Analytics)
  };

  const toggleCardFlip = (index: number) => {
    const newFlipped = [...flippedCards];
    newFlipped[index] = !newFlipped[index];
    setFlippedCards(newFlipped);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-darkGray/90 to-neutral-darkGray/70 backdrop-blur-md text-neutral-lightGray relative">
      {/* Hero Section */}
      <motion.section
        className="py-20 px-4 text-center backdrop-blur-md bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl rounded-xl mx-auto max-w-4xl mt-8"
        initial="hidden"
        animate="visible"
        variants={headingFade}
      >
        <div className="container mx-auto px-4">
          <motion.h1 className="text-5xl font-bold mb-4 text-accent-gold" variants={fadeIn}>
            About Eventify
          </motion.h1>
          <motion.p className="text-xl mb-8" variants={fadeIn}>
            Connecting people through unforgettable events.
          </motion.p>
          <motion.div className="flex justify-center gap-4" variants={fadeIn}>
            <motion.button
              onClick={() => navigate('/')}
              className="inline-block bg-secondary-deepRed text-neutral-lightGray px-6 py-3 rounded-full font-semibold hover:bg-secondary-darkRed transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Back to Home
            </motion.button>
            <motion.button
              onClick={() => navigate('/events')}
              className="inline-block bg-accent-gold text-neutral-darkGray px-6 py-3 rounded-full font-semibold hover:bg-accent-gold/80 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Explore Events
            </motion.button>
          </motion.div>
        </div>
      </motion.section>

      {/* Mission Section */}
      <motion.section
        className="py-16 px-4 backdrop-blur-md bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl rounded-xl mx-auto max-w-3xl mt-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerChildren}
      >
        <div className="container mx-auto px-4">
          <motion.h2
            className="text-3xl font-bold text-center mb-12 text-accent-gold"
            variants={fadeIn}
          >
            Our Mission
          </motion.h2>
          <motion.p className="text-lg text-center" variants={fadeIn}>
            At Eventify, we believe that every moment deserves to be celebrated and shared. Our
            mission is to empower individuals and communities to create, manage, and enjoy events
            effortlessly—whether it’s a small gathering or a grand celebration. We’re here to make
            event planning simple, collaborative, and fun.
          </motion.p>
        </div>
      </motion.section>

      {/* Team Section */}
      <motion.section
        className="py-16 px-4 backdrop-blur-md bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl rounded-xl mx-auto max-w-3xl mt-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerChildren}
      >
        <div className="container mx-auto px-4">
          <motion.h2
            className="text-3xl font-bold text-center mb-12 text-accent-gold"
            variants={fadeIn}
          >
            Meet the Team
          </motion.h2>
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8" variants={staggerChildren}>
            {[
              { 
                name: 'Joel Tom', 
                role: 'Lead Developer & UX Researcher', 
                bio: 'Joel Tom leads Eventify’s development efforts and drives user experience research to ensure seamless and intuitive designs.', 
                funFact: 'Enjoys exploring new UX trends over coffee!' 
              },
              { 
                name: 'Alex Okongo', 
                role: 'Co-Developer', 
                bio: 'Alex Okongo collaborates on development, manages documentation, and incorporates user feedback to enhance Eventify’s features.', 
                funFact: 'Loves gathering user insights during hikes!' 
              },
              { 
                name: 'Beckham Mayaka', 
                role: 'Documentation & UX Researcher', 
                bio: 'Beckham Mayaka oversees documentation and conducts user experience research to improve Eventify’s usability.', 
                funFact: 'Passionate about creating user-friendly docs!' 
              },
            ].map((member, index) => (
              <motion.div
                key={member.name}
                className="relative bg-neutral-offWhite text-neutral-darkGray p-6 rounded-xl shadow hover:shadow-2xl transition-shadow cursor-pointer"
                variants={fadeIn}
                whileHover={{ scale: 1.03, transition: { duration: 0.3 } }}
                onClick={() => toggleCardFlip(index)}
              >
                <motion.div
                  className="w-full h-full"
                  animate={flippedCards[index] ? 'back' : 'front'}
                  variants={cardFlip}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {/* Front Side */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <FaUserCircle className="text-4xl mx-auto mb-4 text-gray-500" />
                    <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                    <p className="text-sm mb-4 text-accent-gold">{member.role}</p>
                    <p>{member.bio}</p>
                  </div>
                </motion.div>
                <motion.div
                  className="w-full h-full"
                  animate={flippedCards[index] ? 'front' : 'back'}
                  variants={cardFlip}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {/* Back Side */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                    <p className="text-sm mb-4 text-accent-gold">Fun Fact</p>
                    <p>{member.funFact}</p>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
          <motion.p className="text-center mt-8" variants={fadeIn}>
            Want to join us?{' '}
            <a href="mailto:support@eventify.com" className="text-accent-gold hover:underline font-semibold">
              Get in touch!
            </a>
          </motion.p>
        </div>
      </motion.section>

      {/* Contact Section */}
      <motion.section
        className="py-16 px-4 backdrop-blur-md bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl rounded-xl mx-auto max-w-lg mt-8 mb-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerChildren}
      >
        <div className="container mx-auto px-4">
          <motion.h2
            className="text-3xl font-bold text-center mb-12 text-accent-gold"
            variants={fadeIn}
          >
            Contact Us
          </motion.h2>
          <motion.div className="max-w-lg mx-auto" variants={fadeIn}>
            {submitted ? (
              <motion.p
                className="text-center text-green-500 mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 360] }}
                transition={{ duration: 0.8, type: 'spring', bounce: 0.5 }}
              >
                Thank you! We’ll get back to you soon.
              </motion.p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm mb-1">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray focus:ring-2 ${
                      formErrors.name ? 'ring-red-500' : 'focus:ring-accent-gold'
                    }`}
                    required
                    aria-required="true"
                    aria-invalid={formErrors.name ? "true" : "false"}
                    aria-describedby={formErrors.name ? 'name-error' : undefined}
                  />
                  {formErrors.name && (
                    <p id="name-error" className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray focus:ring-2 ${
                      formErrors.email ? 'ring-red-500' : 'focus:ring-accent-gold'
                    }`}
                    required
                    aria-required="true"
                    aria-invalid={formErrors.email ? "true" : "false"}
                    aria-describedby={formErrors.email ? 'email-error' : undefined}
                  />
                  {formErrors.email && (
                    <p id="email-error" className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    className={`w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray focus:ring-2 ${
                      formErrors.message ? 'ring-red-500' : 'focus:ring-accent-gold'
                    }`}
                    rows={4}
                    required
                    aria-required="true"
                    aria-invalid={formErrors.message ? "true" : "false"}
                    aria-describedby={formErrors.message ? 'message-error' : undefined}
                  />
                  {formErrors.message && (
                    <p id="message-error" className="text-red-500 text-sm mt-1">{formErrors.message}</p>
                  )}
                </div>
                {error && <p className="text-red-500 text-center">{error}</p>}
                <motion.button
                  type="submit"
                  className="w-full bg-secondary-deepRed text-neutral-lightGray px-6 py-3 rounded-full font-semibold hover:bg-secondary-darkRed transition-all"
                  disabled={loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </motion.button>
              </form>
            )}
          </motion.div>
          <motion.div className="text-center mt-8" variants={fadeIn}>
            <h4 className="text-lg font-semibold mb-4 text-accent-gold">Follow Us</h4>
            <div className="flex justify-center space-x-4">
              <div className="relative">
                <motion.a
                  href="https://facebook.com/eventify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Facebook"
                  onClick={() => handleSocialClick('Facebook')}
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaFacebook className="h-6 w-6 text-neutral-lightGray hover:text-secondary-deepRed" />
                </motion.a>
                <motion.div
                  className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-primary-navy text-white text-xs rounded py-1 px-2 opacity-0"
                  initial={{ opacity: 0, y: 10 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  Facebook
                </motion.div>
              </div>
              <div className="relative">
                <motion.a
                  href="https://twitter.com/eventify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Twitter"
                  onClick={() => handleSocialClick('Twitter')}
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaTwitter className="h-6 w-6 text-neutral-lightGray hover:text-secondary-deepRed" />
                </motion.a>
                <motion.div
                  className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-primary-navy text-white text-xs rounded py-1 px-2 opacity-0"
                  initial={{ opacity: 0, y: 10 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  Twitter
                </motion.div>
              </div>
              <div className="relative">
                <motion.a
                  href="https://instagram.com/eventify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Instagram"
                  onClick={() => handleSocialClick('Instagram')}
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaInstagram className="h-6 w-6 text-neutral-lightGray hover:text-secondary-deepRed" />
                </motion.a>
                <motion.div
                  className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-primary-navy text-white text-xs rounded py-1 px-2 opacity-0"
                  initial={{ opacity: 0, y: 10 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  Instagram
                </motion.div>
              </div>
              <div className="relative">
                <motion.a
                  href="https://linkedin.com/company/eventify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on LinkedIn"
                  onClick={() => handleSocialClick('LinkedIn')}
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaLinkedin className="h-6 w-6 text-neutral-lightGray hover:text-secondary-deepRed" />
                </motion.a>
                <motion.div
                  className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-primary-navy text-white text-xs rounded py-1 px-2 opacity-0"
                  initial={{ opacity: 0, y: 10 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  LinkedIn
                </motion.div>
              </div>
            </div>
            <p className="mt-4">
              Or reach us at{' '}
              <a href="mailto:info@eventify.com" className="text-accent-gold hover:underline">
                info@eventify.com
              </a>
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Back to Top Button */}
      <motion.button
        className="fixed bottom-8 right-8 bg-accent-gold text-neutral-darkGray p-3 rounded-full shadow-lg"
        onClick={scrollToTop}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: showBackToTop ? 1 : 0, scale: showBackToTop ? 1 : 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Scroll to top"
      >
        <FaArrowUp size={20} />
      </motion.button>
    </div>
  );
}

export default About;