# Architecture Diagrams - Threads of Thought Blog

## 1. C4 Model Diagrams

### Level 1: System Context Diagram

```mermaid
graph TB
    User[Blog Reader]
    Author[Content Author]
    
    BlogSystem[Threads of Thought Blog<br/>Static Site]
    
    GitHub[GitHub Repository]
    GitHubPages[GitHub Pages<br/>Hosting]
    Giscus[Giscus Comments<br/>GitHub Discussions]
    GoogleFonts[Google Fonts CDN]
    GoatCounter[GoatCounter Analytics]
    
    User -->|Reads posts, searches| BlogSystem
    Author -->|Writes markdown posts| GitHub
    BlogSystem -->|Deployed to| GitHubPages
    BlogSystem -->|Comments via| Giscus
    BlogSystem -->|Fonts from| GoogleFonts
    BlogSystem -->|Analytics via| GoatCounter
    GitHub -->|Auto-deploy| GitHubPages
```

### Level 2: Container Diagram

```mermaid
graph TB
    subgraph "Threads of Thought Blog System"
        WebApp[Static Web Application<br/>HTML/CSS/JS]
        SearchIndex[Search Index<br/>JSON]
        RSS[RSS Feed<br/>XML]
        Sitemap[Sitemap<br/>XML]
    end
    
    subgraph "Build System"
        AstroSSG[Astro SSG<br/>Build Process]
        MarkdownFiles[Markdown Content<br/>Blog Posts]
    end
    
    subgraph "External Systems"
        GitHubPages[GitHub Pages]
        Giscus[Giscus Comments]
        GoogleFonts[Google Fonts]
        GoatCounter[GoatCounter Analytics]
    end
    
    User[Blog Reader] -->|HTTPS| WebApp
    Author[Content Author] -->|Git Push| MarkdownFiles
    
    MarkdownFiles -->|Build Time| AstroSSG
    AstroSSG -->|Generates| WebApp
    AstroSSG -->|Generates| SearchIndex
    AstroSSG -->|Generates| RSS
    AstroSSG -->|Generates| Sitemap
    
    WebApp -->|Hosted on| GitHubPages
    WebApp -->|Comments API| Giscus
    WebApp -->|Font Loading| GoogleFonts
    WebApp -->|Analytics| GoatCounter
```

### Level 3: Component Diagram

```mermaid
graph TB
    subgraph "Web Application Components"
        subgraph "Pages"
            IndexPage[Index Page<br/>Homepage with post list]
            BlogPost[Blog Post Page<br/>Individual post view]
            SearchPage[Search Page<br/>Full-text search]
            TagPages[Tag Pages<br/>Posts by tag]
            DatePages[Date Pages<br/>Posts by date]
        end
        
        subgraph "Layouts"
            BlogLayout[BlogPost Layout<br/>Post template]
        end
        
        subgraph "Components"
            Header[Header Component<br/>Navigation & search]
            Sidebar[Sidebar Component<br/>Calendar & tags]
            Search[Search Component<br/>Lunr.js integration]
            Comments[Comments Component<br/>Giscus integration]
        end
        
        subgraph "Utilities"
            ReadingTime[Reading Time Calculator]
            SearchIndexGen[Search Index Generator]
        end
    end
    
    IndexPage --> Header
    IndexPage --> Sidebar
    BlogPost --> BlogLayout
    BlogLayout --> Header
    BlogLayout --> Sidebar
    BlogLayout --> Comments
    Header --> Search
    SearchPage --> Search
    Search --> SearchIndexGen
    BlogLayout --> ReadingTime
```

## 2. System Context Diagram

```mermaid
graph LR
    subgraph "External Actors"
        Reader[Blog Reader]
        Author[Content Author]
        SearchEngine[Search Engines]
    end
    
    subgraph "Core System"
        Blog[Threads of Thought Blog]
    end
    
    subgraph "External Systems"
        GitHub[GitHub Repository]
        GitHubPages[GitHub Pages]
        Giscus[Giscus Comments]
        GoogleFonts[Google Fonts]
        GoatCounter[GoatCounter Analytics]
        RSS[RSS Readers]
    end
    
    Reader -->|Reads posts, searches content| Blog
    Author -->|Writes markdown posts| GitHub
    SearchEngine -->|Crawls for indexing| Blog
    
    Blog -->|Deployed via CI/CD| GitHubPages
    Blog -->|Comments integration| Giscus
    Blog -->|Font loading| GoogleFonts
    Blog -->|Analytics tracking| GoatCounter
    Blog -->|RSS feed| RSS
    GitHub -->|Source code & content| Blog
```

## 3. Data Flow Diagram

```mermaid
flowchart TD
    subgraph "Content Creation"
        A[Author writes Markdown] --> B[Git commit & push]
        B --> C[GitHub Repository]
    end
    
    subgraph "Build Process"
        C --> D[GitHub Actions Trigger]
        D --> E[Astro Build Process]
        E --> F[Process Markdown Files]
        F --> G[Generate Static HTML]
        F --> H[Create Search Index]
        F --> I[Generate RSS Feed]
        F --> J[Create Sitemap]
    end
    
    subgraph "Deployment"
        G --> K[Deploy to GitHub Pages]
        H --> K
        I --> K
        J --> K
    end
    
    subgraph "User Interaction"
        K --> L[User visits site]
        L --> M[Load static content]
        M --> N[Client-side search]
        M --> O[Interactive calendar]
        M --> P[Comments loading]
    end
    
    H --> N
    P --> Q[Giscus API]
```

## 4. Component Architecture Diagram

```mermaid
graph TB
    subgraph "Application Architecture"
        subgraph "Presentation Layer"
            HTML[Static HTML Pages]
            CSS[Global Styles]
            JS[Client-side JavaScript]
        end
        
        subgraph "Component Layer"
            AstroComponents[Astro Components]
            Layouts[Page Layouts]
        end
        
        subgraph "Data Layer"
            Markdown[Markdown Files]
            Frontmatter[YAML Frontmatter]
            SearchIndex[JSON Search Index]
        end
        
        subgraph "Build Layer"
            AstroSSG[Astro Static Site Generator]
            Plugins[Astro Plugins & Integrations]
        end
    end
    
    Markdown --> AstroSSG
    Frontmatter --> AstroSSG
    AstroComponents --> AstroSSG
    Layouts --> AstroSSG
    Plugins --> AstroSSG
    
    AstroSSG --> HTML
    AstroSSG --> CSS
    AstroSSG --> JS
    AstroSSG --> SearchIndex
```

## 5. Technology Stack Visualization

```mermaid
graph TB
    subgraph "Frontend Technologies"
        HTML5[HTML5]
        CSS3[Vanilla CSS]
        VanillaJS[Vanilla JavaScript]
        Shiki[Shiki<br/>Syntax Highlighting]
        Lunr[Lunr.js<br/>Search Engine]
    end
    
    subgraph "Framework & Build"
        Astro[Astro SSG<br/>v5.14.3]
        Node[Node.js]
        NPM[NPM Package Manager]
    end
    
    subgraph "Content & Data"
        Markdown[Markdown Files]
        YAML[YAML Frontmatter]
        JSON[JSON Data Files]
    end
    
    subgraph "External Services"
        GitHubPages[GitHub Pages<br/>Hosting]
        GitHubActions[GitHub Actions<br/>CI/CD]
        Giscus[Giscus<br/>Comments]
        GoogleFonts[Google Fonts<br/>Typography]
        GoatCounter[GoatCounter<br/>Analytics]
    end
    
    Astro --> HTML5
    Astro --> CSS3
    Astro --> VanillaJS
    VanillaJS --> Shiki
    VanillaJS --> Lunr
    
    Markdown --> Astro
    YAML --> Astro
    JSON --> Lunr
    
    Node --> Astro
    NPM --> Node
    
    GitHubActions --> GitHubPages
```

## 6. Feature-Based Architecture Diagrams

### Search System Architecture

```mermaid
flowchart LR
    subgraph "Search Implementation"
        A[Blog Posts] --> B[Build Time Processing]
        B --> C[Generate search-index.json]
        C --> D[Lunr.js Index Creation]
        D --> E[Client-side Search]
        E --> F[Dropdown Results]
        E --> G[Search Page Results]
    end
    
    subgraph "Search Components"
        H[Search Component] --> I[Search Input]
        H --> J[Results Dropdown]
        K[Search Page] --> L[Full Results Display]
    end
    
    D --> H
    D --> K
```

### Calendar System Architecture

```mermaid
flowchart TD
    A[Blog Posts with Dates] --> B[Extract Post Dates at Build Time]
    B --> C[Pass Dates to Client]
    C --> D[Client-side Calendar Generation]
    D --> E[Generate Calendar Grid with Current Date]
    E --> F[Mark Days with Posts]
    F --> G[Interactive Calendar]
    G --> H[Month Navigation]
    G --> I[Year Navigation]
    G --> J[Click to View Posts]
    J --> K[Date-based Routing]
```

### Comments System Architecture

```mermaid
flowchart TD
    A[Blog Post Page] --> B[Comments Component]
    B --> C[Giscus Integration]
    C --> D[GitHub Discussions API]
    D --> E[Load Comments]
    E --> F[Display Comments]
    F --> G[User Interaction]
    G --> H[GitHub OAuth]
    H --> I[Post Comments]
```

## 7. Deployment Pipeline Diagram

```mermaid
flowchart TD
    A[Developer writes content] --> B[Git commit to main branch]
    B --> C[GitHub webhook triggers]
    C --> D[GitHub Actions workflow starts]
    
    subgraph Build["Build Process"]
        D --> E[Checkout code]
        E --> F[Setup Node.js]
        F --> G[Install dependencies]
        G --> H[Run astro build]
        H --> I[Generate static files]
    end
    
    subgraph Deploy["Deployment"]
        I --> J[Deploy to GitHub Pages]
        J --> K[Update DNS]
        K --> L[Site live]
    end
    
    subgraph Verify["Verification"]
        L --> M[Health checks]
        M --> N[RSS feed updated]
        M --> O[Search index updated]
        M --> P[Sitemap updated]
    end
```

## 8. Security & Performance Architecture

```mermaid
graph TB
    subgraph Security["Security Measures"]
        A[Static Site Generation<br/>No server vulnerabilities]
        B[GitHub Pages HTTPS<br/>SSL/TLS encryption]
        C[Content Security Policy<br/>XSS protection]
        D[No sensitive data<br/>Client-side only]
    end
    
    subgraph Performance["Performance Optimizations"]
        E[Pre-built static files<br/>Fast loading]
        F[CDN delivery<br/>GitHub Pages CDN]
        G[Optimized images<br/>Proper sizing]
        H[Minimal JavaScript<br/>Vanilla JS only]
        I[Font optimization<br/>Google Fonts preload]
    end
    
    subgraph Monitoring["Monitoring"]
        J[GitHub Pages analytics]
        K[RSS feed validation]
        L[Search functionality testing]
    end
```

## Usage Notes

- **C4 Model**: Shows system at different abstraction levels
- **System Context**: External dependencies and actors
- **Data Flow**: How content moves through the system
- **Component Architecture**: Internal structure and relationships
- **Technology Stack**: All technologies used in layers
- **Feature Diagrams**: Specific functionality implementations
- **Deployment Pipeline**: CI/CD process flow
- **Security/Performance**: Non-functional requirements

These diagrams can be rendered using Mermaid in any Markdown viewer or documentation platform.