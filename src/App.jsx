import { ContentProvider } from './ContentContext.jsx';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import About from './components/About.jsx';
import Experience from './components/Experience.jsx';
import Projects from './components/Projects.jsx';
import GuideSection from './components/GuideSection.jsx';
import Scheduler from './components/Scheduler.jsx';
import BlogSection from './components/BlogSection.jsx';
import Chatbot from './components/Chatbot.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  return (
    <ContentProvider>
      <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        <Nav />
        <span id="top" />
        <Hero />
        <About />
        <Experience />
        <Projects />
        <GuideSection />
        <Scheduler />
        <BlogSection />
        <Chatbot />
        <Footer />
      </div>
    </ContentProvider>
  );
}
