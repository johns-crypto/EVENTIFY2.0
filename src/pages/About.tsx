import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { FaUserCircle } from 'react-icons/fa';

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

function About() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, 'contactMessages'), {
        ...formData,
        timestamp: new Date().toISOString(),
      });
      console.log('Form submitted:', formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      setError('Failed to send message. Try again later.');
      console.error('Error submitting form:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray">
      {/* Hero Section */}
      <motion.section
        className="bg-primary-navy py-20 text-center"
        initial="hidden"
        animate="visible"
        variants={headingFade}
      >
        <div className="container mx-auto px-4">
          <motion.h1 className="text-5xl font-bold mb-4" variants={fadeIn}>
            About Eventify
          </motion.h1>
          <motion.p className="text-xl mb-8" variants={fadeIn}>
            Connecting people through unforgettable events.
          </motion.p>
          <motion.div className="flex justify-center gap-4" variants={fadeIn}>
            <Link
              to="/"
              className="inline-block bg-secondary-deepRed text-neutral-lightGray px-6 py-3 rounded-lg font-semibold hover:bg-secondary-darkRed"
            >
              Back to Home
            </Link>
            <button
              onClick={() => navigate('/events')}
              className="inline-block bg-accent-gold text-neutral-darkGray px-6 py-3 rounded-lg font-semibold hover:bg-accent-gold/80"
            >
              Explore Events
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* Mission Section */}
      <motion.section
        className="py-16"
        initial="hidden"
        animate="visible"
        variants={staggerChildren}
      >
        <div className="container mx-auto px-4">
          <motion.h2
            className="text-3xl font-bold text-center mb-12 text-accent-gold"
            variants={fadeIn}
          >
            Our Mission
          </motion.h2>
          <motion.p className="text-lg max-w-3xl mx-auto text-center" variants={fadeIn}>
            At Eventify, we believe that every moment deserves to be celebrated and shared. Our
            mission is to empower individuals and communities to create, manage, and enjoy events
            effortlessly—whether it’s a small gathering or a grand celebration. We’re here to make
            event planning simple, collaborative, and fun.
          </motion.p>
        </div>
      </motion.section>

      {/* Team Section */}
      <motion.section
        className="py-16 bg-primary-navy"
        initial="hidden"
        animate="visible"
        variants={staggerChildren}
      >
        <div className="container mx-auto px-4">
          <motion.h2
            className="text-3xl font-bold text-center mb-12 text-accent-gold"
            variants={fadeIn}
          >
            Meet the Team
          </motion.h2>
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto" variants={staggerChildren}>
            {[
              { name: 'Joel Tom', role: 'Lead Developer', bio: 'Joel Tom crafts the robust tech backbone of Eventify.' },
              { name: 'Alex Okongo', role: 'Lead Developer', bio: 'Alex Okongo ensures Eventify’s features are seamless and innovative.' },
            ].map((member) => (
              <motion.div
                key={member.name}
                className="bg-neutral-offWhite text-neutral-darkGray p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
                variants={fadeIn}
              >
                <FaUserCircle className="text-4xl mx-auto mb-4 text-gray-500" />
                <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                <p className="text-sm mb-4 text-accent-gold">{member.role}</p>
                <p>{member.bio}</p>
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
        className="py-16"
        initial="hidden"
        animate="visible"
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
              <p className="text-center text-green-500 mb-4">Thank you! We’ll get back to you soon.</p>
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
                    className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray focus:ring-2 focus:ring-accent-gold"
                    required
                    aria-required="true"
                  />
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
                    className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray focus:ring-2 focus:ring-accent-gold"
                    required
                    aria-required="true"
                  />
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
                    className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray focus:ring-2 focus:ring-accent-gold"
                    rows={4}
                    required
                    aria-required="true"
                  />
                </div>
                {error && <p className="text-red-500 text-center">{error}</p>}
                <button
                  type="submit"
                  className="w-full bg-secondary-deepRed text-neutral-lightGray px-6 py-3 rounded-lg font-semibold hover:bg-secondary-darkRed disabled:bg-gray-500"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </motion.div>
          <motion.p className="text-center mt-8" variants={fadeIn}>
            Or reach us at{' '}
            <a href="mailto:support@eventify.com" className="text-accent-gold hover:underline">
              support@eventify.com
            </a>
          </motion.p>
        </div>
      </motion.section>
    </div>
  );
}

export default About;