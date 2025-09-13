import selfPortrait from '../assets/Pictures/SelfPortrait.png'

export default function Sections() {
  return (
    <div id="board" className="w-4/5 mx-auto">
      <div id="content">
        <img
          id="selfportrait"
          src={selfPortrait}
          alt="Self Portrait"
          className="mx-auto rounded-full w-1/3"
        />

        <h1 id="title" className="toptitle text-center font-bold">I am Fredric Hegland!</h1>

        <div className="textBox" id="welcome">
          <h2>Welcome to my portfolio-website!</h2>
          <p>Here you can find information about me, my projects and my contact information.</p>
        </div>

        <div className="textBox" id="about">
          <h2>About me:</h2>
          <p>
            I am currently pursuing a bachelors degree in Computer Technology at the University of Bergen, where I
            delve into different topics in informatics and computer technology. Some of the my favorite topics are
            computer programming and low-level stuff!
          </p>
        </div>

        <div className="textBox" id="experience">
          <h2>Experience:</h2>
          <h4>I have had multiple part time jobs since I startet to study:</h4>

          <p>Amitec AS - Student Software Engineer (November 2024 - d.d.)</p>
          <p className="sub">
            Working with time-series-data, optimalization and IT/OT through{' '}
            <a href="https://docs.aveva.com/category/pi-system" target="_blank" rel="noopener noreferrer">
              AVEVA PI systems
            </a>
            , such as PI AF, PI Vision, PI SMT for customers in the energy sector.
          </p>

          <p>IKEA Leangen/Åsane, Trondheim/Bergen - Sales Co-worker (May 2022 - February 2025)</p>
          <p className="sub">
            Worked in the warehouse and sales department, where I was responsible for customer service, stock management
            and sales.
          </p>

          <p>McDonalds Nidarvoll, Trondheim - Co-worker (January 2022 - April 2022)</p>
          <p className="sub">Prepping food as a line-cook</p>

          <p>Roseborg Bakeri, Trondheim - Driver and storage-worker (September 2021 - January 2022)</p>
          <p className="sub">
            Worked as a driver and storage-worker, where I was responsible for delivering bread and pastries to
            private-customers and bakeries.
          </p>
        </div>

        <div className="textBox" id="education">
          <h2>Education:</h2>
          <p>
            University of Bergen, Bergen -{' '}
            <a
              href="https://www4.uib.no/program/informatikk-datateknologi-bachelor/plan"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bachelors in Computer Technology
            </a>{' '}
            (August 2022 - June 2025)
          </p>
          <p>
            NTNU Handleshøyskolen, Trondheim -{' '}
            <a href="https://www.ntnu.no/studier/boat" target="_blank" rel="noopener noreferrer">
              Economics and Administration
            </a>{' '}
            (August 2021 - June 2022)
          </p>
          <p>
            Sandsli Videregående Skole Bergen -{' '}
            <a
              href="https://www.sandsli.vgs.no/utdanningsprogram/vare-utdanningsprogram/studiespesialisering/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Study specialization with science subjects
            </a>{' '}
            (August 2018 - June 2021)
          </p>
        </div>

        <div className="textBox" id="boardpositions">
          <h2>Board positions and volunteer work:</h2>
          <p>ITxBergen Leader (January 2024 - d.d.)</p>
          <p className="sub">
            Leader of the organization, with overall responsibility for organizing the annual career day for all IT
            students in Bergen, as well as other smaller events. Responsible for important administrative decisions and
            organizational development. Started as a board member, became leader in January 2024.
          </p>
          <p>ITxBergen Board Member (September 2022 - d.d.)</p>
          <p className="sub">
            Worked with organizing and planning the annual career day and other minor events for all IT students in
            Bergen.
          </p>
          <p>Vektorprogrammet - Assistant (September 2023 - Oktober 2023)</p>
          <p className="sub">
            Assisted as a tutor in Mathematics 1P-Y during classes at Danielsen Videregående Skole, Bergen.
          </p>
        </div>

        <div className="textBox" id="courses">
          <h2>Courses and certificates:</h2>
          <p>NSM grunnprinsipper for IKT-sikkerhet (Oktober 2022)</p>
          <p className="sub">ID: E320-Sikkerhetsmåned2022</p>

          <p>PI System Basics (November 2024)</p>
          <p className="sub">ID: AV092191wmbm</p>

          <p>Asset Framework: Basics (November 2024)</p>
          <p className="sub">ID: AVuxtcnkzynu</p>

          <p>Troubleshooting Basics for Administrators (Desember 2024)</p>
          <p className="sub">ID: AV40acuigpxh</p>

          <p>PI Vision Basics (Desember 2024)</p>
          <p className="sub">ID: AVaali88a7ox</p>

          <p>PI System Administration: Basics (Desember 2024)</p>
          <p className="sub">ID: AVnmbjtyj47n</p>
        </div>

        <div className="textBox" id="contact">
          <h2>Contact:</h2>
          <h4>Feel free to contact me on any of these platforms:</h4>
          <p>
            <a
              href="https://www.linkedin.com/in/fredric-hegland-8a8972206/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </p>
          <p>
            <a href="https://github.com/frheg" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </p>
          <p>Email: fredric.hegland@gmail.com</p>
          <p>Phone: +47 45 66 73 72</p>
        </div>

        <div className="textBox" id="footer">
          <footer>
            <p>© 2025 Fredric Hegland</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
