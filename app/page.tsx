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

const LoadIndx: React.FC = () => {
  const [deleting, setDeleting] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [indexing, setIndexing] = useState<boolean>(false);
  const [indexProgressPercent, setIndexProgressPercent] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [stateInfo, setState] = useState<StateInfo>({ systemState: 0 });

  const [token, setToken] = useState<string>("");
  const [url, setUrl] = useState<string>('https://api.indx.co/api/'); // Starting url

  // Credentials. Can be set in UI, or pre-populated here.
  const [usr, setUsr] = useState<string>(''); // Indx Auth username (e-mail)
  const [pw, setPw] = useState<string>(''); // Password

  const [heap, setHeapId] = useState<string>("0"); // Default to heap 0
  const [configuration, setConfiguration] = useState<string>("100"); // Config 100 is the most common
  const [selectedFile, setSelectedFile] = useState<string>('movie_names.txt'); // Predefined files
  const [uploadedFile, setUploadedFile] = useState<File | null>(null); // Upload custom .txt file
  const [customFileName, setCustomFileName] = useState<string>('');

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
  const GetState = async (): Promise<StateInfo> => {
    try {
      const response = await fetch(`${url}Search/${heap}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': token,
        },
      });
  
      const data = await response.json();
      if (data && typeof data === 'object') {
        setState(data);
        return data;
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      console.error("Error getting state", error);
      return { systemState: 0, indexProgressPercent: 0 };
    }
  };
  

  // 1 Delete an entire heap
  // Make sure the heap you want to index is cleared and ready
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

  // 2 Create a heap
  // Before indexing, we need to create an instance
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

  // 3 Load data from predefined or uploaded file
  // This function takes a .txt file and splits it by line number
  const LoadData = async (): Promise<void> => {
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
        const response = await fetch(`/${selectedFile}`);
        text = await response.text();
      }
  
      // Split the content by lines
      const lines = text.split('\n');

      // Create the document
      const data: Document[] = lines.map((line, index): Document => {
        return {
          deleted: false,
          documentClientInformation: "",
          documentKey: index,
          documentTextToBeIndexed: line,
          segmentNumber: 0
        };
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
  
  // 4 Start indexing
  // Run indexing on the loaded data
  const DoIndex = async (): Promise<void> => {
    setIndexing(true);
    setIndexProgressPercent(0); // Reset progress on start
  
    try {
      await fetch(url + "Search/" + "DoIndex/" + heap, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
          'Authorization': token,
        }
      });
  
      const intervalId = setInterval(async () => {
        const state = await GetState(); // Get the latest state info
        const progress = state.indexProgressPercent || 0;
        setIndexProgressPercent(progress);
  
        if (progress >= 100) {
          clearInterval(intervalId);
          setIndexing(false); // Correctly update the indexing state here
        }
      }, 20);
    } catch (error) {
      console.error("Error indexing", error);
      setIndexing(false);
    }
  };  

  // 5 Save heap for persistence
  // Save the index for persistence on the file system
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

  //
  // UI Input handlers
  //

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
    setCustomFileName('');
  };
  const handleCustomFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setUploadedFile(file);
      setSelectedFile('custom');
      setCustomFileName(file.name);
    }
  };
  

  return (
    <main id={styles.main}>
      <div id={styles.left}>

        <label> 
          <select value={url} onChange={handleUrlChange}>
            <option value='https://api.indx.co/api/'>api.indx.co</option>
            <option value='http://localhost:38171/api/'>Localhost (:38171)</option>
          </select>
        </label>

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

        <br />

        <div>
        heap <input
            style={{ width: '30px' }}
            type="text"
            placeholder="HeapID"
            value={heap}
            onChange={handleHeapChange}
          />
        </div>
        <div>
        configuration <input
            style={{ width: '30px' }}
            type="text"
            placeholder="Configuration"
            value={configuration}
            onChange={handleConfigurationChange}
          />
        </div>

        
        <div>
          <label>
            <select style={{ width: '100%' }} value={selectedFile} onChange={handleFileChange}>
              <option value="movie_names.txt">movie_names.txt</option>
              <option value="movie_metadata.txt">movie_metadata.txt</option>
              <option value="airports.txt">airports.txt</option>
              <option value="custom">Upload custom .txt file...</option>
            </select>
          </label>

          {selectedFile === 'custom' && (
            <div className={styles.selectFile}>
              <input id="file-input" type="file" onChange={handleCustomFileChange} />
              <label htmlFor="file-input">Choose a .txt file</label>
              {uploadedFile && <div>Selected file: {customFileName}</div>}
            </div>
          )}
        </div>

        <br />

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

        {indexing && (
          <div className={styles.progressBarWrapper}>{indexProgressPercent}%
            <div className={styles.progressBarContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${indexProgressPercent}%` }}
              />
            </div>
          </div>
        )}

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

export default LoadIndx;
