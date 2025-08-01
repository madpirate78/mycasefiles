React & PDF Rendering

#

javascript

#

react

#

webdev

#

tutorial
Portable Document Format (PDF) - developed 30 years ago still exists and is one of the most widely-used documents formats. There are many reasons why people still prefer to use them such as the widely supported document format which works is compatible with many devices and apps, and the content always remains the same format.

What is React-PDF ?
React-pdf lets us render documents on server and web.
It exports a set of React primitives that can be used to render things into documents easily and we can use CSS properties for styling and flexbox for layout. A list of supported primitives can be found here It supports rendering text, images, SVGs and many more.

What we going to build ?
Today we will be looking at how we can create and style PDF with react-pdf renderer. React-pdf package lets us create awesome looking PDFs using React. Its simple to use and the documentation is developer-friendly. We will create a simple application that dynamically updates our PDF-styled template which we render in DOM.

This example will show how you can render the document in DOM and how directly save the document into the file without the need of displaying it.

Demo

1. Setup

npx create-react-app app && cd app && yarn add @react-pdf/renderer

As in the time of writing tutorial react-pdf render need some extra dependencies and craco configuration.

yarn add process browserify-zlib stream-browserify util buffer assert @craco/craco

Change the scripts section in package.json as below:

"scripts": {
"start": "craco start",
"build": "craco build",
"test": "craco test",
"eject": "react-scripts eject"
},

Next, create a new file in the root of the project
craco.config.js with

const webpack = require("webpack");

module.exports = {
webpack: {
configure: {
resolve: {
fallback: {
process: require.resolve("process/browser"),
zlib: require.resolve("browserify-zlib"),
stream: require.resolve("stream-browserify"),
util: require.resolve("util"),
buffer: require.resolve("buffer"),
asset: require.resolve("assert"),
},
},
plugins: [
new webpack.ProvidePlugin({
Buffer: ["buffer", "Buffer"],
process: "process/browser",
}),
],
},
},
};

mkdir Components && cd Components && mkdir PDF && cd PDF && touch Preview.js && touch LeftSection.js && touch RightSection.js

├── App.css
├── App.js
├── index.js
├── PDF
│ ├── LeftSection.js
│ ├── Preview.js
│ └── RightSection.js
└── styles
└── index.js

In our App.js we will create a state that updates on user input when changes are detected we will re-render our page.

javascript
import Preview from './PDF/Preview'
import React, { useState } from 'react'
function App() {
const [profile, setProfile] = useState({
type: 'Profile',
name: 'John Doe',
profession: 'Junior Developer',
profileImageURL: 'https://i.imgur.com/f6L6Y57.png',
display: true,
about: 'About...',
})

const handleChange = (name, value) => {
setProfile({ ...profile, [name]: value })
}

return (
<div
style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
      }} >
<div style={{ width: '50%' }}>
<div>
<label>Name</label>
<input
name='name'
defaultValue={profile.name}
onChange={(e) => {
handleChange(e.target.name, e.target.value)
}}
/>
</div>
<div>
<label>Profession</label>
<input
name='profession'
defaultValue={profile.profession}
onChange={(e) => {
handleChange(e.target.name, e.target.value)
}}
/>
</div>
<div>
<label>ImageURL</label>
<input
name='profileImageURL'
defaultValue={profile.profileImageURL}
onChange={(e) => {
handleChange(e.target.name, e.target.value)
}}
/>
</div>
<div>
<label>About</label>
<input
name='about'
defaultValue={profile.about}
onChange={(e) => {
handleChange(e.target.name, e.target.value)
}}
/>
</div>
</div>
<Preview profile={profile} />
</div>
)
}

export default App

Preview.js
This will let us render a preview on half of the page and embed the Template document that we are about to create.
We also have PDFDownloadLink which can be used to download pdf without the need of rendering it in the DOM.

import React from 'react'
import { Document, Page, PDFViewer, PDFDownloadLink } from '@react-pdf/renderer'
import LeftSection from './LeftSection'
import { RightSection } from './RightSection'
import styles from '../styles'

const Preview = ({ profile }) => {
return (
<div style={{ flexGrow: 1 }}>
<PDFViewer
showToolbar={false}
style={{
          width: '100%',
          height: '95%',
        }} >
<Template profile={profile} />
</PDFViewer>
<PDFDownloadLink
document={<Template profile={profile} />}
fileName='somename.pdf' >
{({ loading }) => (loading ? 'Loading document...' : 'Download now!')}
</PDFDownloadLink>
</div>
)
}
// Create Document Component
const Template = ({ profile }) => {
return (
<Document>
<Page size='A4' style={styles.page}>
// We will divide our document into 2 columns
<LeftSection profile={profile} />
<RightSection about={profile.about} />
</Page>
</Document>
)
}

export default Preview

We will also create folder with styles where we will keep stylesSheet for react-render primitives.

mkdir styles && cd styles && mkdir index.js

styles

import { StyleSheet } from '@react-pdf/renderer'

export default StyleSheet.create({
page: {
display: 'flex',
flexDirection: 'row',
},
section_right: {
margin: 10,
padding: 10,
paddingTop: 20,
width: '75%',
},
section_left: {
width: '25%',
height: '100%',
backgroundColor: '#084c41',
},
profile_container: {
display: 'flex',
flexDirection: 'column',
alignItems: 'center',
marginTop: '20',
marginBottom: '20px',
height: '150',
fontFamily: 'Helvetica-Bold',
},
name_text: {
paddingTop: '10px',
paddingBottom: '5px',
fontSize: '14px',
fontWeight: '900',
color: 'white',
},
profession_text: {
color: '#d1d5db',
fontSize: '11px',
},
profile_img: {
width: '60px',
height: '60px',
borderRadius: '90',
},
profile_line: {
marginTop: '10px',
width: '10%',
height: '1px',
backgroundColor: '#FFF',
textAlign: 'center',
},
})

LeftSection.js

import { View, Text, Image } from '@react-pdf/renderer'
import styles from '../styles'

export const Profile = ({ profile }) => {
return (
<View style={styles.profile_container}>
<Image style={styles.profile_img} src={profile.profileImageURL} />

      <View
        style={{
          justifyContent: 'center',
        }}
      >
        <Text style={styles.name_text}>{profile.name}</Text>
      </View>
      <Text style={styles.profession_text}>{profile.profession}</Text>
      <View style={styles.profile_line} />
    </View>

)
}

const LeftSection = ({ profile }) => {
return (
<View style={styles.section_left}>
<Profile profile={profile} />
</View>
)
}

export default LeftSection

RightSection.js

import styles from '../styles'
import { View, Text } from '@react-pdf/renderer'

export const RightSection = ({ about }) => {
return (
<View style={styles.section_right}>
<Text>{about}</Text>
</View>
)
}

Now you know it works you could create something yourself.

More functional example of a resume builder that I built is here.
Resume builder

To sum up, this is only a simple demo to demonstrate how the pdf renderer can be used with react. React pdf package very cool tool that could be used to create things like resume builders, invoicing templates or tickets or receipts, etc. These could be either generated based on the existing data or dynamically updated on user input like in the case of our simple demo.

I hope this article was helpful to some of you guys. Thanks for reading!
Github repo
