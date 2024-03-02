'use client'

import { useState } from 'react';
import styles from './page.module.css';

export default function ReadFilePage() {
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stateInfo, setState] = useState([]);

  const [token, setToken] = useState("");

  
  const [url, setUrl] = useState('https://api.indx.co/api/'); // Starting url

  const [usr, setUsr] = useState(''); // Indx Auth username (e-mail)
  const [pw, setPw] = useState(''); // Password

  const [heap, setHeapId] = useState("0");
  const [configuration, setConfiguration] = useState("100");
  const [selectedFile, setSelectedFile] = useState('movie_names.txt');

  const Login = async () => {
    try {
        const response = await fetch(url + "Login?userEmail=" + usr + "&userPassWord=" + pw, {
          method: 'POST',
          headers: {
            'Accept': 'text/plain',
            'Authorization': token,
        }
      });

      const data = await response.json();
      setToken("Bearer " + data.token);

    } catch(error) {
      console.error("Error getting state", error);
    }
  }

  const GetState = async () => {
    try {
        const response = await fetch(url + "Search/" + heap, {
          method: 'GET',
          headers: {
            'Accept': 'text/plain',
            'Authorization': token,
        }
      });

      const data = await response.json();

      setState(data);
      console.log(data);

    } catch(error) {
      console.error("Error getting state", error);
    }
  }
  

  const DeleteHeap = async () => {
    setDeleting(true);
    try {
      await fetch(url + "Search/" + heap, {
        method: 'DELETE',
        headers: {
          'Accept': '*/*',
          'Authorization': token,
      }
    });
    } catch(error) {
      console.error("Error deleting", error);
    } finally {
      setDeleting(false);
    }
  }

  const CreateHeap = async () => {
    setCreating(true);
    try {
      await fetch(url + "Search/" + heap + "/" + configuration, {
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Authorization': token,
      }
    });
    } catch(error) {
      console.error("Error creating", error);
    } finally {
      setCreating(false);
    }
  }

  const LoadData = async () => {
    const segmentSize = 80; // create and use segments if text length is bigger than this
    setLoading(true);
    try {
      // Fetch the file content from the public folder
      const response = await fetch('/' + selectedFile);
      const text = await response.text();
  
      // Split the content by lines
      const lines = text.split('\n');
  
      // Utility function to split long lines into segments
      const splitLongLines = (line) => {
        let segments = [];
        while (line.length > segmentSize) {
          let lastSpaceIndex = line.substring(0, segmentSize + 1).lastIndexOf(' ');
          if (lastSpaceIndex === -1 || lastSpaceIndex === 0) lastSpaceIndex = segmentSize; 
          // In case there's no space, or it's the first character
          segments.push(line.substring(0, lastSpaceIndex));
          line = line.substring(lastSpaceIndex + 1); // +1 to skip the space
        }
        segments.push(line); // Add the remaining part of the line
        return segments;
      };
  
      // Map each line to the document class, taking care of long lines
      const data = lines.flatMap((line, index) => {
        const segments = splitLongLines(line);
        return segments.map((segment, segmentIndex) => ({
          deleted: false,
          documentClientInformation: "",
          documentKey: index, // Consider how to handle documentKey with segments
          documentTextToBeIndexed: segment,
          segmentNumber: segmentIndex
        }));
      });
  
      // Send the data to the REST API
      await fetch(url + "Search/" + "array/" + heap, {
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error("Error reading file or sending data:", error);
    } finally {
      setLoading(false);
    }
  }

  const DoIndex = async () => {
    setIndexing(true);
    try {
      await fetch(url + "Search/" + "DoIndex/" + heap, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
          'Authorization': token,
      }
    });
    } catch(error) {
      console.error("Error indexing", error);
    } finally {
      setIndexing(false);
    }
  }

  const SaveHeap = async () => {
    setSaving(true);
    try {
      await fetch(url + "Search/" + heap, {
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Authorization': token,
      }
    });
    } catch(error) {
      console.error("Error saving", error);
    } finally {
      setSaving(false);
    }
  }

  const handleUrlChange = (event) => {
    setUrl(event.target.value);
  }
  
  const handleHeapChange = (event) => {
    setHeapId(event.target.value);
  }
  
  const handleConfigurationChange = (event) => {
    setConfiguration(event.target.value);
  }
  
  const handleFileChange = (event) => {
    setSelectedFile(event.target.value);
  }
  
  const handleUsrChange = (event) => {
    setUsr(event.target.value);
  }
  
  const handlePwChange = (event) => {
    setPw(event.target.value);
  }

  return (
    <main id={styles.main}>
      <div id={styles.left}>

      <input
        type="text"
        placeholder="Username"
        value={usr}
        onChange={handleUsrChange}
      />
      <input
        type="Password"
        placeholder="Password"
        value={pw}
        onChange={handlePwChange}
      />


      <button onClick={Login}>
        Login</button>

      <label> 
        <select value={url} onChange={handleUrlChange}>
          <option value='https://api.indx.co/api/'>api.indx.co</option>
          <option value='http://localhost:38171/api/'>Local (:38171)</option>
        </select>
      </label>
      

      heap <input
          style={{ width: '30px' }}
          type="text"
          placeholder="HeapID"
          value={heap}
          onChange={handleHeapChange}
        />
      configuration <input
          style={{ width: '30px' }}
          type="text"
          placeholder="Configuration"
          value={configuration}
          onChange={handleConfigurationChange}
        />

      file
      <label>
        <select style={{ width: '100%' }} value={selectedFile} onChange={handleFileChange}>
          <option value="movie_names.txt">movie_names.txt</option>
          <option value="movie_metadata.txt">movie_metadata.txt</option>
          <option value="airports.txt">airports.txt</option>
        </select>
      </label>

      <button onClick={DeleteHeap} disabled={deleting}>
        {deleting ? "Deleting..." : "Delete Heap"}</button>

      <button onClick={CreateHeap} disabled={creating}>
        {creating ? "Creating..." : "Create Heap"}</button>

      <button onClick={LoadData} disabled={loading}>
        {loading ? "Processing..." : "Read and Send Data"}</button>

      <button onClick={DoIndex} disabled={indexing}>
        {indexing ? "Indexing..." : "Do Index"}</button>

      <button onClick={SaveHeap} disabled={saving}>
        {saving ? "Saving heap..." : "SaveHeap"}</button>

      <p className={styles.token}>{token}</p>
      
      </div>

      <div>
        
        <button onClick={GetState}>Get state</button>
        <p>Response body:</p>
        <p>system state: {stateInfo.systemState}</p>
        <ul>
          {Object.entries(stateInfo).map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong> {value !== null && value !== undefined ? value.toString() : 'N/A'}
            </li>
          ))}
        </ul>

      </div>


    </main>
  );
}
