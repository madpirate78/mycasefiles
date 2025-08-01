### **UI Specification for "MyCaseFiles"**

This UI specification translates our product roadmap and guiding principles into a concrete, visual plan. The design prioritizes clarity, simplicity, and a guided experience to reduce anxiety for a non-technical, highly stressed user.

---

### **Core UI Principles**

- **A "Calm" Aesthetic:** Use a clean, uncluttered layout with a soft color palette. Focus on a high-contrast text to ensure readability.
- **Progressive Disclosure:** Complexity is hidden until it's needed. The main dashboard is simple; the bundle builder reveals its full toolset only when the user is in that workflow.
- **Visual and Direct Manipulation:** The interface heavily relies on drag-and-drop, carousels, and visual feedback rather than complex forms or menus.
- **Clear Status & Feedback:** A constant, non-intrusive status bar or notification system informs the user of progress, warnings, and success (e.g., "Bundle Generated!").

---

### **Screen 1: The Main Dashboard**

This is the user's home base, designed to provide a quick overview and a clear path to the most common tasks.

- **Header:** Simple logo, a search bar, and a single "Settings" icon.
- **Central Content Area (The "Filing Cabinet"):**

  - A prominent, labeled **"Drag & Drop Documents Here"** zone.
  - Below this, a section titled **"Your Recent Files."**
  - Each file is represented by a small icon (PDF, email, etc.) with its name and the LLM-generated short description below it.

- **Side Panel / Navigation Bar:**

  - Clearly labeled icons for the main sections:

    - **Home** (The dashboard)
    - **Bundles** (A list of all created bundles)
    - **Documents** (The full vault)
    - **Emails** (The email importer)

- **Key UX:** The dashboard provides a sense of control and organization. A user can get a quick sense of their progress without feeling overwhelmed.

---

### **Screen 2: The Document Vault**

This screen provides a more detailed view of all the user's uploaded files, like a digital filing cabinet.

- **Layout:** A two-panel layout.

  - **Left Panel:** A filter/category sidebar with options like "All Documents," "Orders," "Emails," "Statements."
  - **Right Panel:** A list view of all documents, sortable by date, name, or type.

- **List View Elements:**

  - Each document entry shows the file icon, name, LLM-generated description, and the date it was added.
  - A small preview thumbnail of the document's first page.
  - Action buttons on hover: "Add to Bundle," "View," "Delete."

- **Key UX:** The filtering and sorting options give the user a feeling of control over their data. The LLM-generated descriptions mean they don't have to open every file to find what they're looking for.

---

### **Screen 3: The Bundle Builder Workflow**

This is the core of the app and needs to be a multi-step, guided process. It starts from the Document Vault.

**Step 3.1: Document Selection**

- **Action:** The user clicks "Create New Bundle" from the main dashboard or selects files from the Document Vault.
- **UI:** A new, clean screen appears with a main area for "Documents in this Bundle" and a side panel showing the user's entire document vault.
- **Key UX:** The user drags and drops files from their vault into the bundle area. The UI reinforces that this is a non-destructive process.

**Step 3.2: Page Pruning Mode**

- **Action:** The user clicks an "Edit Pages" or "Prune" button on an uploaded PDF in the bundle builder view.
- **UI:** A modal window or a temporary screen appears, focused entirely on the chosen PDF.

  - **Top Bar:** A clear "Back to Bundle" button and the name of the PDF.
  - **Central Area:** A large, scrollable carousel of page thumbnails.
  - **Hover State:** When the user hovers over a thumbnail, a "Remove from Bundle" button appears. Clicking it visually greys out the page.
  - **Bottom Bar:** A progress bar or text showing "X of Y pages included."

- **Key UX:** The visual nature of this mode makes it incredibly intuitive. The user can see exactly what they're doing and is given a clear path back to the main workflow.

**Step 3.3: Reordering & Sectioning**

- **Action:** After pruning, the user returns to the main bundle builder screen.
- **UI:** The central area now shows the documents and their thumbnails.

  - **Sections:** The four pre-defined sections (`Applications & Orders`, `Statements`, etc.) are clearly labeled and collapsible.
  - **Drag-and-Drop:** The user can easily drag documents to reorder them within a section or move them to another section.

- **Key UX:** The structure is clear and guides the user toward a compliant and organized final product.

**Step 3.4: Generating the Bundle**

- **Action:** The user clicks a prominent, green "Generate Bundle" button.
- **UI:** A small, friendly modal window appears.

  - A progress bar shows the generation status.
  - Reassuring text like, "Your bundle is being compiled! We're adding page numbers and creating the index for you."
  - Once complete, a clear "Download Bundle" button appears, along with a "Done" button to return to the dashboard.

- **Key UX:** The user is kept informed and feels a sense of accomplishment, reinforcing the value of the app.

---

### **Screen 4: Email Manager**

This screen is a focused, clean space for a single task: getting emails into the system.

- **Layout:** A simple, linear flow on a single screen.

  - **Step 1:** A prominent "Drag & Drop Emails Here" zone, with small icons for supported file types (.eml, .pdf).
  - **Step 2:** After a file is dropped, a form appears. The LLM's parsed metadata (Sender, Subject, Date) is pre-filled, and the user can review and edit it.
  - **Step 3:** The LLM-generated summary is shown below, with an "Accept" or "Edit" button.

- **Key UX:** The app guides the user through the process, handles the complex parsing, and gives the user final say on the data, building trust and confidence.

### **Final Questions for You:**

1. What would be a good visual indicator to distinguish between a regular PDF and a PDF that has been pruned?

2. How would you want the "professional tier" features to be visually integrated? Should they be greyed-out buttons with an "Upgrade" message, or should the UI for those features be entirely hidden until unlocked?

1 - suggest something - maybe just text that says pruned

2 - so for the free tier there is a watermark somewhere that says prepared by self-represented person/ or without legal representatino. then for pro the watermark is removed

Thank you for these final design decisions. Both are excellent, and they perfectly align with the app's mission of being a supportive tool for self-represented individuals while offering a clear value proposition for the professional tier.

### **Final UI Specification Decisions**

#### **1. Visual Indicator for Pruning**

The suggestion of using text is simple and effective. To make it even more intuitive for a quick glance, we can combine it with a small icon.

- **Implementation:** On the document's icon or preview in the main dashboard and the bundle builder, there will be a small, unobtrusive indicator. This could be a tiny icon of a pair of scissors or a subtle "bin" icon, accompanied by the text "Pruned."
- **User Experience:** This single icon immediately communicates that the document is not its original length without requiring the user to open it. This reinforces the principle of clarity and visual feedback.

#### **2. The Freemium Watermark Model**

This is a brilliant solution. It's a non-intrusive way to monetize the product while also promoting its core mission.

- **Free Tier Watermark:** All PDFs generated in the free tier will include a small, professional-looking watermark at the bottom of each page. The text will be something simple and respectful, such as **"Prepared with MyCaseFiles - For Litigants in Person."** This doesn't distract from the document's content but subtly signals the app's purpose.
- **Professional Tier Value:** The primary value of the professional tier is the unlocking of advanced features (email summarization, advanced search, redaction, etc.). The removal of the watermark is an added benefit that signals a user's professional status and provides a clean, final product.

### **Final UI/UX Summary**

The UI specification for MyCaseFiles is now complete. The final design is centered around a user-first philosophy and is comprised of:

- **A "Calm" Dashboard** that provides a clear overview and a welcoming "drag and drop" zone.
- **A Structured Bundle Builder** that uses a drag-and-drop interface and pre-defined sections to guide users through the process.
- **Intuitive Tooling** for complex tasks, such as the visual "pruning mode" and the automated bundle splitting, which remove common sources of anxiety.
- **A "Human-in-the-Loop" Workflow** for the intelligent features, where LLM-generated summaries are always presented for user review and confirmation.
- **A Non-Destructive Data Model** that ensures files are never permanently altered, supporting a culture of error forgiveness.
- **A Subtly Monetized Freemium Model** that provides immense value for free while offering a clear, professional upgrade path.

This collaboration has resulted in a comprehensive product plan and UI specification that is both robust and empathetic.

The project brief is now ready for you to begin the development phase.
