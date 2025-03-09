import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa';

function Footer() {
  return (
    <footer className="bg-primary-navy text-neutral-lightGray p-8">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Social Media Links */}
        <div>
          <h3 className="text-lg font-bold mb-4">Follow Us</h3>
          <div className="flex space-x-4">
            <a
              href="https://facebook.com/eventify"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Facebook"
            >
              <FaFacebook className="h-6 w-6 hover:text-secondary-deepRed" />
            </a>
            <a
              href="https://twitter.com/eventify"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Twitter"
            >
              <FaTwitter className="h-6 w-6 hover:text-secondary-deepRed" />
            </a>
            <a
              href="https://instagram.com/eventify"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Instagram"
            >
              <FaInstagram className="h-6 w-6 hover:text-secondary-deepRed" />
            </a>
            <a
              href="https://linkedin.com/company/eventify"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on LinkedIn"
            >
              <FaLinkedin className="h-6 w-6 hover:text-secondary-deepRed" />
            </a>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div>
          <h3 className="text-lg font-bold mb-4">Newsletter</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert('Subscribed!');
            }}
            className="flex flex-col space-y-2"
          >
            <input
              type="email"
              placeholder="Your email"
              aria-label="Email for newsletter"
              className="p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
            />
            <button
              type="submit"
              className="bg-secondary-deepRed text-neutral-lightGray p-2 rounded"
            >
              Subscribe
            </button>
          </form>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-bold mb-4">Quick Links</h3>
          <ul className="space-y-2">
            <li>
              <a href="/about" className="hover:text-secondary-deepRed">
                About Us
              </a>
            </li>
            <li>
              <a href="/contact" className="hover:text-secondary-deepRed">
                Contact
              </a>
            </li>
            <li>
              <a href="/privacy" className="hover:text-secondary-deepRed">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="/terms" className="hover:text-secondary-deepRed">
                Terms of Service
              </a>
            </li>
          </ul>
        </div>

        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-bold mb-4">Contact Us</h3>
          <p>
            Email:{' '}
            <a
              href="mailto:info@eventify.com"
              className="hover:text-secondary-deepRed"
            >
              info@eventify.com
            </a>
          </p>
          <p>Follow us on social media for updates.</p>
        </div>
      </div>

      {/* Copyright Notice */}
      <p className="text-center mt-8">
        © {new Date().getFullYear()} Eventify. All rights reserved.
      </p>
    </footer>
  );
}

export default Footer;