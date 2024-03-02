'use client'

import React, { useState, ChangeEvent } from 'react';
import styles from './page.module.css';


interface AccessToken {
  token?: string;
  [key: string]: any; // Extend this to fit the actual API response
}

interface Document {
  deleted: boolean;
  documentClientInformation: string;
  documentKey: number;
  documentTextToBeIndexed: string;
  segmentNumber: number;
}
interface StateInfo {
  systemState: number;
  [key: string]: any; // Add other properties as needed
}

const ReadFilePage: React.FC = () => {
  const [deleting, setDeleting] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [indexing, setIndexing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [stateInfo, setState] = useState<StateInfo>({ systemState: 0 });

  const [token, setToken] = useState<string>("");
  const [url, setUrl] = useState<string>('https://api.indx.co/api/'); // Starting url

  const [splitLongLines, setSplitLongLines] = useState<boolean>(false); // split text into segments if needed. Maximum line length in configuration 100 is 300 characters
  const [segmentLength, setSegmentLength] = useState<number>(80);

  // Credentials. Can be set in UI, or pre-populated here.
  const [usr, setUsr] = useState<string>(''); // Indx Auth username (e-mail)
  const [pw, setPw] = useState<string>(''); // Password

  const [heap, setHeapId] = useState<string>("0"); // Default to heap 0
  const [configuration, setConfiguration] = useState<string>("100"); // Config 100 is the most common
  const [selectedFile, setSelectedFile] = useState<string>('movie_names.txt'); // Predefined files
  const [uploadedFile, setUploadedFile] = useState<File | null>(null); // Upload custom .txt file


  // Login to fetch API token
  const Login = async (): Promise<void> => {
    try {
      const response = await fetch(url + "Login?userEmail=" + usr + "&userPassWord=" + pw, {
        method: 'POST',
        headers: {
          'Accept': 'text/plain',
          'Authorization': token,
        },
      });

      const data: AccessToken = await response.json();
      console.log("Bearer " + data.token);
      setToken("Bearer " + data.token);
    } catch (error) {
      console.error("Error getting state", error);
    }
  };

  // Check state of system
  const GetState = async (): Promise<void> => {
    try {
      const response = await fetch(url + "Search/" + heap, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
          'Authorization': token,
        },
      });

      const data = await response.json();
      setState(data);
      console.log(data);
    } catch (error) {
      console.error("Error getting state", error);
    }
  };

  // Delete an entire heap
  const DeleteHeap = async (): Promise<void> => {
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
      setState({systemState: 0})
    }
  };

  // Create a heap
  const CreateHeap = async (): Promise<void> => {
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
      GetState();
    }
  };

  // Load data from predefined or uploaded file
  const LoadData = async (shouldSplit: boolean): Promise<void> => {
    setLoading(true);
    try {
      let text = '';
  
      // Check if a user-selected file is present
      if (uploadedFile) {
        // Use FileReader to read the file content
        text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(uploadedFile);
        });
      } else {
        // Fallback to fetching a predefined file
        const response = await fetch(`/${selectedFile}`);
        text = await response.text();
      }
  
      // Split the content by lines
      const lines = text.split('\n');
      const targetSegmentLength = segmentLength; // Ideal segment length
      const minLastSegmentLength = targetSegmentLength / 2; // Minimum length for the last segment
  
      // Utility function for segmentation logic
      const splitAndNormalizeLines = (line: string, targetLength: number, minLength: number): string[] => {
        let segments: string[] = [];
        if (!shouldSplit) {
          segments.push(line); // Use the line as-is if splitting is disabled
          return segments;
        }
  
        let totalLength = line.length;
        let estimatedSegments = Math.ceil(totalLength / targetLength);
        if (totalLength - (estimatedSegments - 1) * targetLength < minLength) {
          estimatedSegments++;
        }
  
        let averageLength = Math.ceil(totalLength / estimatedSegments);
        let start = 0;
  
        while (start < totalLength) {
          let end = start + averageLength > totalLength ? totalLength : start + averageLength;
          let cutPoint = line.lastIndexOf(' ', end);
  
          if (cutPoint <= start || cutPoint === -1) cutPoint = Math.min(end, totalLength);
  
          segments.push(line.substring(start, cutPoint).trim());
          start = cutPoint + 1;
        }
  
        if (segments.length > 1 && segments[segments.length - 1].length < minLength) {
          let lastSegment = segments.pop();
          segments[segments.length - 1] += ' ' + lastSegment;
        }
  
        return segments;
      };
  
      // Map each line to the Document class, considering the shouldSplit flag
      const data: Document[] = lines.flatMap((line, index): Document[] => {
        const segments = splitAndNormalizeLines(line, targetSegmentLength, minLastSegmentLength);
        return segments.map((segment, segmentIndex): Document => ({
          deleted: false,
          documentClientInformation: "",
          documentKey: index,
          documentTextToBeIndexed: segment,
          segmentNumber: segmentIndex,
        }));
      });
  
      // Send the data to the REST API
      await fetch(`${url}Search/array/${heap}`, {
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Authorization': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Error loading data", error);
    } finally {
      setLoading(false);
      GetState();
    }
  };
  
  // Start indexing
  const DoIndex = async (): Promise<void> => {
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
      GetState();
    }
  }

  // Save heap for persistence
  const SaveHeap = async (): Promise<void> => {
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
  };

  // Input handlers

  const handleUsrChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setUsr(event.target.value);
  };

  const handlePwChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setPw(event.target.value);
  };
  
  const handleUrlChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setUrl(event.target.value);
  };

  const handleHeapChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setHeapId(event.target.value);
  };

  const handleConfigurationChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setConfiguration(event.target.value);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedFile(event.target.value);
    setUploadedFile(null);
  };
  const handleCustomFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setUploadedFile(file);
      setSelectedFile('custom');
    }
  };

  const handleSplitLines = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setSplitLongLines(event.target.checked);
  };

  const handleSegmentLength = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
      setSegmentLength(value);
    }
  };
  

  return (
    <main id={styles.main}>
      <div id={styles.left}>

        credentials
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

        <button onClick={Login}>Login</button>

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
        {/* <div> */}
          <label>
            <select style={{ width: '100%' }} value={selectedFile} onChange={handleFileChange}>
              <option value="movie_names.txt">movie_names.txt</option>
              <option value="movie_metadata.txt">movie_metadata.txt</option>
              <option value="airports.txt">airports.txt</option>
              <option value="custom">Upload custom file...</option>
            </select>
          </label>

          {selectedFile === 'custom' && (
            <label>
              <input type="file" onChange={handleCustomFileChange} style={{ width: '100%' }} />
            </label>
          )}
        {/* </div> */}


        segmentation
        <label style={{ fontSize: '12px' }}>
          <input 
            type="checkbox" 
            checked={splitLongLines}
            onChange={handleSplitLines} 
          />
          Split Long Lines?
          {splitLongLines && (
            <span>
                <input 
                    style={{ width: '40px'}}
                    type="number" 
                    value={segmentLength}
                    onChange={handleSegmentLength} 
                />
                chars
            </span>
          )}



        </label>

        <button onClick={DeleteHeap} disabled={deleting}>
          {deleting ? "Deleting..." : "Delete Heap"}</button>

        <button onClick={CreateHeap} disabled={creating}>
          {creating ? "Creating..." : "Create Heap"}</button>

        <button onClick={() => LoadData(splitLongLines)} disabled={loading}>
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
        <p>system state: {
          (() => {
            const systemStates: Record<number, string> = {
              0: 'Created, not loaded',
              1: '🚛 Loaded and ready to index',
              2: '⏳ Indexing',
              3: '🟢 Ready to search'
            };

            const hasOnlySystemState = Object.entries(stateInfo).every(([key, value]) => {
              if (key === 'systemState') return true; // Ignore systemState in the check
              const isEmpty = value === false || value === 0 || value === "" || value === null || value === undefined;
              return isEmpty;
            });

            if (stateInfo.systemState === 0 && !token) {
              return 'Not connected';
            }
            // Check if we essentially have no meaningful information beyond systemState
            else if (hasOnlySystemState) {
              return 'No status obtained';
            }
            // Return the corresponding system state message or 'Unknown state' if not found
            return systemStates[stateInfo.systemState] || 'Unknown state';
          })()
        }</p>

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
};

export default ReadFilePage;
