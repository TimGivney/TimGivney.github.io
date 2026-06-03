import { useState } from 'react';

/**
 * Industrial Modernism Design — Single Page Scroll
 * - Deep cobalt blue (#1B3F6B) + warm gold (#C9A84C)
 * - Playfair Display for headings, Source Sans 3 for body, JetBrains Mono for labels
 * - Clean hero with content left, image right — no text overlay
 * - Leadership section, detailed Technical Capabilities, Interests & Passions
 */

export default function Home() {
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  const projects = [
    {
      id: 'ap50',
      title: 'AP+ AP50 Diaphragm Pump',
      subtitle: 'Lead Designer & Product Development',
      description: 'Precision vacuum diaphragm pump designed for industrial applications. Engineered high-performance 50CFM pump with optimised casting, FEA analysis, and precision manufacturing workflows.',
      tags: ['CAD', 'FEA', 'Manufacturing', 'Product Design'],
      image: '/assets/ASM-DP-APP-50CFM_AP50-AP-PLUS-50CFM-DIAPHRAGM-PUMP-VIEW-5-WITH-QD-BUSH-PULLEY-scaled_4bff7966.jpg',
      link: 'https://partsbender.com/product/ap-ap50-50-cfm-vacuum-diaphragm-pump/'
    },
    {
      id: '2c440',
      title: 'AP+ 2C440 Air Compressor',
      subtitle: 'Design & Development',
      description: 'Advanced air compressor system with precision engineering and thermal optimization. Developed through iterative testing and FEA analysis to deliver high-performance industrial compression.',
      tags: ['Air Compressor', 'Thermal Analysis', 'Manufacturing', 'FEA'],
      image: '/assets/AP-AP37-CFM-2C440-Air-Compressor-Crankcase-Cut-In-Half-Checking-Porisity-First-Samples_Jun2025_3_d9586f9d.jpg',
      link: 'https://partsbender.com'
    },
    {
      id: 'skapa',
      title: 'SKAPA Sunglasses',
      subtitle: 'Product Design & Manufacturing',
      description: 'High-performance sunglasses engineered for durability and style. Designed with precision manufacturing techniques and optimised for comfort and visual clarity in demanding environments.',
      tags: ['Product Design', 'Manufacturing', 'Materials', 'CAD'],
      image: '/assets/instagram-image-1_7d10d541.jpg',
      link: 'https://partsbender.com',
      nativeRatio: true
    },
    {
      id: 'lora',
      title: 'Long Range Radio (LoRa) Weather and Air Quality Station',
      subtitle: 'IoT & Environmental Monitoring',
      description: 'A battery-powered long-range weather and air quality monitoring station built with a Raspberry Pi Pico and LoRaWAN, capable of transmitting environmental data to a live online dashboard for remote monitoring and alerts.',
      tags: ['LoRaWAN', 'Raspberry Pi Pico', 'IoT', 'Environmental Monitoring'],
      image: '/assets/lora-weather-station_4c46c7eb.jpg',
      link: 'https://partsbender.com'
    },
    {
      id: 'wled',
      title: 'WLED Smart Lighting',
      subtitle: 'Technical Education & IoT',
      description: 'How to Easily Control Addressable LEDs with an ESP32 or ESP8266 | WLED Project. Comprehensive guide reaching 580k+ views, demonstrating custom pixel art and LED effects without coding.',
      tags: ['ESP32', 'IoT', 'Electronics', 'Education'],
      image: '/assets/wled-project_967547a3.jpg',
      link: 'https://www.youtube.com/@timgivney',
      nativeRatio: true
    }
  ];

  const experience = [
    {
      company: 'PartsBender',
      role: 'Engineering & Operations Support',
      period: '2023 – Present',
      description: 'Supporting industrial engineering and manufacturing operations across product development, CAD systems, production preparation, inventory coordination, and technical e-commerce.'
    },
    {
      company: 'Cobalt CNC',
      role: 'CNC Workshop Operator',
      period: '2023 – 2024',
      description: 'Operated SYIL X11 CNC systems for precision machining and fabrication. Utilised 3D scanning technologies and CAD workflow support for product development.'
    },
    {
      company: 'Core Electronics',
      role: 'Creative Technologist / Engineer',
      period: '2020 – 2023',
      description: 'Produced 100+ educational videos and technical resources for the maker community, accumulating 2M+ YouTube views. Facilitated workshops and technical communication.'
    },
    {
      company: 'CASMAT Pty Ltd',
      role: 'Contract Engineer',
      period: '2019 – 2020',
      description: 'Executed critical industrial maintenance projects within high-stakes, heavy-industry sites including the Tomago Aluminium Smelter and Liddell Power Station under strict safety compliance.'
    },
    {
      company: 'Coal Mines (Mount Thorley & Hunter Valley)',
      role: 'Industrial Machinery Servicing',
      period: '2018',
      description: 'Handled heavy machinery asset maintenance at Mount Thorley and Hunter Valley Coal Mines, ensuring operational reliability in demanding industrial environments.'
    }
  ];

  const interests: { image: string; alt: string; fullWidth?: boolean; contain?: boolean }[] = [
    {
      image: '/assets/tim-main-photo_215ad6e8.jpg',
      alt: 'Tim Givney'
    },
    {
      image: '/assets/instagram-image-2_299dc666.jpg',
      alt: 'Adventure'
    },
    {
      image: '/assets/50CFM-Vacuum-Pump-AP-AP50-AP_50CFM-Production-Castings_24_5d3d5a3c.jpg',
      alt: 'Manufacturing'
    },
    {
      image: '/assets/thermal-imaging_0bc375a1.jpg',
      alt: 'Engineering'
    },
    {
      image: '/assets/interests-image-1_fa0650ad.jpg',
      alt: 'Project work'
    },
    {
      image: '/assets/interests-image-2_ddc23267.jpg',
      alt: 'Outdoor exploration'
    },
    {
      image: '/assets/interests-image-3_d21ba2c7.jpg',
      alt: 'Nature photography'
    },
    {
      image: '/assets/interests-image-7_b0c377b2.jpg',
      alt: 'Wildlife'
    },
    {
      image: '/assets/parrot-photo_093f39bc.webp',
      alt: 'Australian birdlife'
    },
    {
      image: '/assets/extra-1_3739e11d.jpg',
      alt: 'Exploration'
    },
    {
      image: '/assets/car-restoration_ab1305d7.jpg',
      alt: 'Car restoration project'
    },
    {
      image: '/assets/extra-4_d7ec8dde.jpeg',
      alt: 'Industrial work'
    },
    {
      image: '/assets/race-car_48cc937c.webp',
      alt: 'Historic racing'
    },
    {
      image: '/assets/macaw_1c65cbdd.webp',
      alt: 'Australian wildlife'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <a href="#about" className="text-2xl font-bold" style={{ color: '#1B3F6B' }} aria-label="Tim Givney — home">Tim Givney</a>
          <div className="flex gap-8 text-sm">
            <a href="#about" className="hover:text-blue-700 transition-colors">About</a>
            <a href="#experience" className="hover:text-blue-700 transition-colors">Experience</a>
            <a href="#projects" className="hover:text-blue-700 transition-colors">Projects</a>
            <a href="#leadership" className="hover:text-blue-700 transition-colors">Leadership</a>
            <a href="#education" className="hover:text-blue-700 transition-colors">Education</a>
          </div>
        </div>
      </nav>

      {/* Hero Section — Clean layout, no text overlay */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div>
            <h1 className="text-6xl font-bold mb-4" style={{ color: '#1B3F6B' }}>Tim Givney</h1>
            <p className="text-lg mb-6" style={{ color: '#1B3F6B' }}>Industrial Engineering • Manufacturing • Technical Systems</p>
            <p className="text-base leading-relaxed text-gray-700 mb-12">I design, manufacture, and field-test high-reliability mechanical and electronic systems that survive the harshest real-world environments. From heavy-industry mine sites to precision CNC machining and technical media collectively garnering millions of views, I combine hardcore workshop execution with advanced engineering to turn complex concepts into working hardware.</p>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-4xl font-bold" style={{ color: '#C9A84C' }}>2M+</div>
                <div className="text-xs label mt-2">YouTube Views</div>
              </div>
              <div>
                <div className="text-4xl font-bold" style={{ color: '#C9A84C' }}>15+</div>
                <div className="text-xs label mt-2">Years Experience</div>
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: '#C9A84C' }}>Newcastle</div>
                <div className="text-xs label mt-2">NSW Australia</div>
              </div>
            </div>
            
            {/* Download Button */}
            <div className="mt-12">
              <a 
                href="/assets/Tim-Givney-Resume_92e1d389.pdf" 
                download="Tim-Givney.pdf"
                className="inline-block px-8 py-3 font-semibold rounded transition-all duration-200"
                style={{ backgroundColor: '#1B3F6B', color: '#FFFFFF' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Download Website
              </a>
            </div>
          </div>
          
          {/* Right: Image */}
          <div className="flex justify-center">
            <img 
              src="/assets/tim-horse-hero_65c8126c.jpg" 
              alt="Tim Givney, mechanical engineer" 
              width={896} height={1152}
              fetchPriority="high" decoding="async"
              className="w-full max-w-sm rounded-lg shadow-lg transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>About</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-gray-700">
              <p>I'm a Mechanical Engineer building systems that survive the real world. My work sits between high-level design and hands-on execution, spanning CNC machining, industrial manufacturing, reverse engineering, and embedded electronics. I focus on practical engineering where reliability, usability, and manufacturability matter most.</p>
              
              <p>Alongside engineering, I build technical education content. I produce technical content spanning embedded systems, microcontroller and microprocessor development, wireless communications (including long-range radio systems), computer vision and applied AI, electronics design, and 3D printing and fabrication workflows. This work has reached over 2 million views on YouTube globally.</p>
              

            </div>
            
            <div className="flex justify-center">
              <img 
                src="/assets/Tim-Partsbender-Organising-Product-whilst-running-CNC-Machine-in-background-Thumbs-Up_805a7cf4.jpg" 
                alt="Tim Givney organising product while running a CNC machine at PartsBender" 
                loading="lazy" decoding="async"
                className="w-full max-w-sm rounded-lg shadow-lg transition-transform duration-300 hover:scale-105"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section id="experience" className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#EEF3F9' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>Experience</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="space-y-8">
            {experience.map((item, idx) => (
              <div key={idx} className="border-l-4 pl-6" style={{ borderColor: '#C9A84C' }}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-2xl font-bold" style={{ color: '#1B3F6B' }}>{item.company}</h3>
                  <span className="label" style={{ color: '#71717A' }}>{item.period}</span>
                </div>
                <h4 className="text-lg font-semibold mb-3" style={{ color: '#1B3F6B' }}>{item.role}</h4>
                <p className="text-gray-700">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section id="projects" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>Featured Products</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="space-y-16">
            {projects.map((project) => (
              <div 
                key={project.id}
                className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
                onMouseEnter={() => setHoveredProject(project.id)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                {/* Content on left */}
                <div className="border-l-4 pl-6" style={{ borderColor: '#C9A84C' }}>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#1B3F6B' }}>{project.title}</h3>
                  <p className="text-sm label mb-4">{project.subtitle}</p>
                  <p className="text-gray-700 mb-6">{project.description}</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags.map((tag, i) => (
                      <span key={i} className="text-xs px-3 py-1 rounded" style={{ backgroundColor: '#EEF3F9', color: '#1B3F6B', border: '1px solid #C9A84C' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  {project.link && (
                    <a 
                      href={project.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block text-sm font-semibold transition-colors duration-200"
                      style={{ color: '#C9A84C' }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      aria-label={`View ${project.title}`}
                    >
                      View Project →
                    </a>
                  )}
                </div>
                
                {/* Image on right - square or native ratio */}
                <div className="flex justify-center">
                  {project.nativeRatio ? (
                    <div className="w-full max-w-sm overflow-hidden rounded-lg shadow-lg" style={{ borderTop: '4px solid #C9A84C' }}>
                      <img 
                        src={project.image} 
                        alt={`${project.title} — ${project.subtitle}`}
                        loading="lazy" decoding="async"
                        className="w-full object-cover transition-transform duration-300"
                        style={{
                          transform: hoveredProject === project.id ? 'scale(1.04)' : 'scale(1)'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-sm aspect-square overflow-hidden rounded-lg shadow-lg" style={{ borderTop: '4px solid #C9A84C' }}>
                      <img 
                        src={project.image} 
                        alt={`${project.title} — ${project.subtitle}`}
                        loading="lazy" decoding="async"
                        className="w-full h-full object-cover transition-transform duration-300"
                        style={{
                          transform: hoveredProject === project.id ? 'scale(1.04)' : 'scale(1)'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership & Volunteer Work Section */}
      <section id="leadership" className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#EEF3F9' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>Leadership & Volunteer Work</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="border-l-4 pl-6" style={{ borderColor: '#C9A84C' }}>
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#1B3F6B' }}>Save Our Coast</h3>
              <p className="text-sm label mb-4">Board Director & Treasurer (Volunteer) | 2019 – Present</p>
              <p className="text-gray-700 mb-4">Environmental leadership and strategic planning for marine conservation. Direct financial records, corporate governance, and strategic funding initiatives—including securing grants from Patagonia Inc.'s 1% Program.</p>
              <p className="text-gray-700 mb-4">Spearheaded operations for large-scale public events drawing 1,500+ attendees. Contributed to historic grassroots conservation victories, including collecting 77,000+ signatures that successfully halted offshore seismic testing and fossil fuel exploration (PEP11) along the NSW coastline.</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 rounded" style={{ backgroundColor: '#FFFFFF', color: '#1B3F6B', border: '1px solid #C9A84C' }}>Environmental Leadership</span>
                <span className="text-xs px-3 py-1 rounded" style={{ backgroundColor: '#FFFFFF', color: '#1B3F6B', border: '1px solid #C9A84C' }}>Marine Conservation</span>
                <span className="text-xs px-3 py-1 rounded" style={{ backgroundColor: '#FFFFFF', color: '#1B3F6B', border: '1px solid #C9A84C' }}>Strategic Planning</span>
              </div>
            </div>
            
            <div className="flex justify-center">
              <img 
                src="/assets/Save_Our_Coast_2-1024x326_bf737df2.webp" 
                alt="Save Our Coast — marine conservation organisation" 
                loading="lazy" decoding="async"
                className="w-full rounded-lg shadow-lg transition-transform duration-300 hover:scale-105"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Technical Capabilities Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>Technical Capabilities & Expertise</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#1B3F6B' }}>🛠️ Mechanical Engineering & Industrial Manufacturing</h3>
              <ul className="space-y-2 text-gray-700 mb-8">
                <li>Design & Reverse Engineering</li>
                <li>Machining & Fabrication</li>
                <li>Fluid Flow & Simulation</li>
                <li>Structural Analysis</li>
              </ul>

              <h3 className="text-lg font-bold mb-4" style={{ color: '#1B3F6B' }}>⚡ Hardware, Firmware & Intelligent Systems</h3>
              <ul className="space-y-2 text-gray-700 mb-8">
                <li>Microcontrollers & Hardware</li>
                <li>Firmware & Automation</li>
                <li>IoT & Integration</li>
              </ul>

              <h3 className="text-lg font-bold mb-4" style={{ color: '#1B3F6B' }}>💻 Software, CAD & Engineering Tools</h3>
              <ul className="space-y-2 text-gray-700">
                <li>Design & Simulation</li>
                <li>Programming & Systems</li>
                <li>Operations & E-Commerce</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#1B3F6B' }}>📢 Technical Communication & Operations</h3>
              <ul className="space-y-2 text-gray-700 mb-8">
                <li>Engineering Media</li>
                <li>Documentation</li>
                <li>Leadership & Compliance</li>
              </ul>

              <h3 className="text-lg font-bold mb-4" style={{ color: '#1B3F6B' }}>📸 Commercial Media & Industrial Imaging</h3>
              <ul className="space-y-2 text-gray-700">
                <li>Visual Asset Creation</li>
                <li>Corporate & Site Media</li>
                <li>Post-Production & Editing</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section id="education" className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#EEF3F9' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>Education & Certifications</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#1B3F6B' }}>Bachelor of Mechanical Engineering (Honours)</h3>
              <p className="text-lg font-semibold mb-2">The University of Sydney</p>
              <p className="text-gray-700">Graduated 2016</p>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4" style={{ color: '#1B3F6B' }}>Professional Certifications</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Forklift Licence</li>
                <li>• Working at Heights & Confined Spaces</li>
                <li>• White Card Construction Certification</li>

                <li>• Lifesaver Certification (Merewether Beach)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interests & Passions Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>Interests & Passions</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="mb-8">
            <p className="text-gray-700 text-lg mb-8">Outside engineering, I spend time rock climbing, skiing, restoring vehicles, exploring fabrication projects, and photographing Australian birdlife — interests that continue to shape my attention to detail, patience, and observation.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {interests.map((item, idx) => (
              <div 
                key={idx}
                className={`overflow-hidden rounded-lg shadow-md transition-transform duration-300 hover:scale-105 ${
                  item.fullWidth ? 'lg:col-span-4' : ''
                }`}
                style={{ borderTop: '4px solid #C9A84C' }}
              >
                <img 
                  src={item.image} 
                  alt={item.alt}
                  loading="lazy" decoding="async"
                  className={`w-full ${
                    item.contain ? 'object-contain' : 'object-cover'
                  } ${
                    item.fullWidth ? 'h-96' : 'h-64'
                  }`}
                  style={item.contain ? { backgroundColor: '#f5f5f5' } : {}}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#EEF3F9' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-4xl font-bold" style={{ color: '#1B3F6B' }}>Get in Touch</h2>
            <div className="flex-1 h-1" style={{ backgroundColor: '#C9A84C' }}></div>
          </div>
          
          <div className="max-w-2xl">
            <p className="text-lg text-gray-700 mb-8">Whether it's manufacturing, product development, technical systems, or solving real-world engineering problems, I'm always interested in meaningful projects and new challenges. Feel free to get in touch if you are too.</p>
            
            <p className="text-lg text-gray-700 mb-12">Contact Details Below.</p>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm label mb-2">Email</p>
                <a href="mailto:timgivney@gmail.com" className="text-lg font-semibold" style={{ color: '#1B3F6B' }}>
                  timgivney@gmail.com
                </a>
              </div>
              <div>
                <p className="text-sm label mb-2">Phone</p>
                <a href="tel:0432504302" className="text-lg font-semibold" style={{ color: '#1B3F6B' }}>
                  0432504302
                </a>
              </div>
            </div>
          </div>
          
          {/* Rock Climbing Image */}
          <div className="mt-16 rounded-lg overflow-hidden shadow-md">
            <img 
              src="/assets/rock-climbing-finish_a009e264.jpg" 
              alt="Tim Givney rock climbing"
              loading="lazy" decoding="async"
              className="w-full h-96 object-contain"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center text-gray-600 text-sm">
          <p>© 2026 Tim Givney. All rights reserved.</p>
          <p className="mt-2">Dedicated to precision, reliability, and continuous improvement.</p>
        </div>
      </footer>
    </div>
  );
}
