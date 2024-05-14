'use client'

import React, { useState, useEffect, ChangeEvent } from 'react';
import styles from './page.module.css';


interface AccessToken {
  token?: string;
  [key: string]: any; // Extend this to fit the actual API response
}

// interface Document {
//   deleted: boolean;
//   documentClientInformation: string;
//   documentKey: number;
//   documentTextToBeIndexed: string;
//   segmentNumber: number;
// }

interface StateInfo {
  systemState: number;
  [key: string]: any;
}

interface DatasetInfo {
  [dataset: string]: any;
}

const LoadIndx: React.FC = () => {
  const [deleting, setDeleting] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState('0/0');
  const [indexing, setIndexing] = useState<boolean>(false);
  const [indexProgressPercent, setIndexProgressPercent] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [stateInfo, setState] = useState<StateInfo>({ systemState: 0 });
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo>({});

  const [apiToken, setApiToken] = useState<string>("");
  const [loginStatus, setLoginStatus] = useState<string>("Not logged in");
  const [isLoggedin, setIsLoggedin] = useState<boolean>(false);
  const [url, setUrl] = useState<string>('https://api.indx.co/api/'); // Starting url

  // Credentials. Can be set in UI, or pre-populated here.
  const [usr, setUsr] = useState<string>(''); // Indx Auth username (e-mail)
  const [pw, setPw] = useState<string>(''); // Password

  const [dataset, setDataset] = useState<string>("test"); // Default to "test"
  const [configuration, setConfiguration] = useState<string>("100"); // Config 100 is the most common
  const [selectedFile, setSelectedFile] = useState<string>('tmdb_top10k_movies.txt'); // Predefined files
  const [uploadedFile, setUploadedFile] = useState<File | null>(null); // Upload custom .txt file
  const [customFileName, setCustomFileName] = useState<string>('');


  const Login = async (): Promise<void> => {
    try {
      const response = await fetch(url + "Login?userEmail=" + usr + "&userPassWord=" + pw, {
        method: 'POST',
        headers: {
          'Accept': 'text/plain',
          'Authorization': apiToken,
        },
      });

      if (response.status === 401) {
        // Unauthorized
        console.error("Login failed: Unauthorized");
        setLoginStatus("Unauthorized. Check credentials");
        setApiToken(""); // Clear token on failure
      } else if (response.status === 400) {
        setApiToken("");
        setLoginStatus("Bad request");
      }
      else {
        const data: AccessToken = await response.json();
        console.log("Bearer " + data.token);
        setApiToken("Bearer " + data.token);
        setLoginStatus("Authorized as " + usr);
        setIsLoggedin(true);
      }
    } catch (error) {
      console.error("Error during login", error);
      setApiToken(""); // Clear token on error
    }
  };

  // Retrieve existing datasets
  const GetDatasets = async (): Promise<void> => {
    try {
      const response = await fetch(`${url}Search/datasets`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
          'Authorization': apiToken,
        },
      });

      const data = await response.json();
      if (data) {
        setDatasetInfo(data);
      } else {
        setDatasetInfo([]);
      }

    } catch(error) {
      console.error("Error getting dataset info", error);
      setDatasetInfo([]);
    }
  }

  // Check state of dataset
  const GetState = async (): Promise<StateInfo> => {
    GetDatasets();
    try {
      const response = await fetch(`${url}Search/${dataset}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': apiToken,
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
  
  // 1 Delete an entire dataset
  // Make sure the dataset you want to index is cleared and ready
  const DeleteDataset = async (): Promise<void> => {
    setDeleting(true);
    try {
      await fetch(url + "Search/" + dataset, {
        method: 'DELETE',
        headers: {
          'Accept': '*/*',
          'Authorization': apiToken,
      }
    });
    } catch(error) {
      console.error("Error deleting", error);
    } finally {
      setDeleting(false);
      setIndexing(false);
      setState({systemState: 0})
      GetDatasets();
    }
  };

  // 2 Create a dataset
  // Before indexing, we need to create an instance
  const CreateDataset = async (): Promise<void> => {
    setCreating(true);
    try {
      await fetch(url + "Search/" + dataset + "/" + configuration, {
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Authorization': apiToken,
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
  // Incremental loading with chunks of 100.000 documents each
  const LoadData = async (): Promise<void> => {
    setLoading(true);
    let totalLines = 0;

    try {
        let text = '';

        if (uploadedFile) {
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

        const lines = text.split('\n').filter(line => line.trim() !== '');
        totalLines = lines.length;
        setLoadingProgress("0 / " + totalLines);

        const chunkSize = 100000;
        let currentIndex = 0;

        while (currentIndex < totalLines) {
            const endLine = Math.min(currentIndex + chunkSize, totalLines);
            const chunk = lines.slice(currentIndex, endLine).map((line, index) => ({
                deleted: false,
                documentClientInformation: "",
                documentKey: currentIndex + index,
                documentTextToBeIndexed: line,
                segmentNumber: 0
            }));

            await fetch(`${url}Search/array/${dataset}`, {
                method: 'PUT',
                headers: {
                    'Accept': '*/*',
                    'Authorization': apiToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });

            for (let i = currentIndex; i < endLine; i += 1000) {
                const currentProgress = Math.min(i + 1000, totalLines);
                await new Promise(resolve => setTimeout(resolve, 0)); // Breaks up the synchronous block
                setLoadingProgress(currentProgress + " / " + totalLines);
            }

            currentIndex = endLine;
        }

        setLoadingProgress(totalLines + " / " + totalLines);
    } catch (error) {
        console.error("Error loading data", error);
        setLoadingProgress("0 / " + totalLines);
    } finally {
        setLoading(false);
        GetState();
    }
  };
  
  // 4 Start indexing
  // Run indexing on the loaded data
  const IndexDataset = async (): Promise<void> => {
    setIndexing(true);
    setIndexProgressPercent(0); // Reset progress on start
  
    try {
      await fetch(url + "Search/" + "IndexDataSet/" + dataset, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
          'Authorization': apiToken,
        }
      });
  
      const intervalId = setInterval(async () => {
        const state = await GetState(); // Get the latest state info
        const progress = state.indexProgressPercent || 0;
        setIndexProgressPercent(progress);
  
        if (progress >= 100) {
          clearInterval(intervalId);
          setIndexing(false);
        }
      }, 100);
    } catch (error) {
      console.error("Error indexing", error);
      setIndexing(false);
    }
  };  

  // 5 Save dataset for persistence
  // Save the index for persistence on the file system
  const SaveDataset = async (): Promise<void> => {
    setSaving(true);
    try {
      await fetch(url + "Search/" + dataset, {
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Authorization': apiToken,
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

  const handleLoginKeyPress = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      Login();
    }
  };

  const LogOut = async (): Promise<void> => {
    setUsr("");
    setPw("");
    setApiToken("");
    setLoginStatus("Not logged in");
    setIsLoggedin(false);
  }
  
  const handleUrlChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setUrl(event.target.value);
  };

  const handleDatasetChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setDataset(event.target.value);
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


  const [showStatusClass, setShowStatusClass] = useState<boolean>(false);
  const toggleStatusClass = () => {
    setShowStatusClass(!showStatusClass);
  }

 // Initial URL setup based on query parameters
 useEffect(() => {
  const queryParams = new URLSearchParams(window.location.search);
  const initialUrl = queryParams.get('url');
  if (initialUrl) {
    setUrl(initialUrl); // Set URL from query parameters
  }
  }, []);
  

  return (
    <main id={styles.main}>
      <div id={styles.left}>

        <div className={styles.dropdown}>
          <label> 
            <select style={{ width: '100%' }} value={url} onChange={handleUrlChange}>
              <option value='https://api.indx.co/api/'>api.indx.co</option>
              <option value='http://localhost:38171/api/'>Localhost (:38171)</option>
            </select>
          </label>
        </div>

        <p className={styles.loginStatus}>{loginStatus}</p>

        {!isLoggedin ? (
          <>
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
            onKeyDown={handleLoginKeyPress}
          />

          <button onClick={Login}>Log in</button>
          </>
        ) : (
          <button onClick={LogOut}>Log out</button>
        )}

        <br />

        <div>
        Dataset<input
            style={{ width: '100px' }}
            type="text"
            placeholder="name"
            value={dataset}
            onChange={handleDatasetChange}
          />
        </div>
        <div>
        Configuration <input
            style={{ width: '30px' }}
            type="text"
            placeholder="Configuration"
            value={configuration}
            onChange={handleConfigurationChange}
          />
        </div>

        <br/>
        
        File
        <div className={styles.dropdown}>
          <label>
            <select style={{ width: '100%' }} value={selectedFile} onChange={handleFileChange}>
              <option value="tmdb_top10k_movies.txt">TMDB Top Movies</option>
              <option value="airports.txt">44K Airports</option>
              <option value="custom">Upload custom .txt file...</option>
            </select>
          </label>

          {selectedFile === 'custom' && (
            <div className={styles.selectFile}>
              <input id="file-input" type="file" accept='.txt' onChange={handleCustomFileChange} />
              <label htmlFor="file-input">Choose a .txt file</label>
              {uploadedFile && <div>Selected file: {customFileName}</div>}
            </div>
          )}
        </div>

        <br />

        <button onClick={DeleteDataset} disabled={deleting}>
          {deleting ? "Deleting..." : "Delete dataset"}</button>

        <button onClick={CreateDataset} disabled={creating}>
          {creating ? "Creating..." : "Create dataset"}</button>

        <button onClick={LoadData} disabled={loading}>
          {loading ? "Processing..." : "Read and Send Data"}</button>

        <button onClick={IndexDataset} disabled={indexing}>
          {indexing ? "Indexing..." : "Do Index"}</button>

        <button onClick={SaveDataset} disabled={saving}>
          {saving ? "Saving dataset..." : "SaveDataset"}</button>

      </div>

      <div id={styles.mid}>
        
        <button onClick={GetState}>Get state</button>

        <p>System state: {
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

            if (stateInfo.systemState === 0 && !apiToken) {
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


        {/* Progess when loading or indexing */}

        {loading && (
          <div className={styles.progressBarWrapper}> 
            Loading and sending documents ({loadingProgress})
          </div>
        )}
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

        {/* Status class */}
        <div className={styles.statusClass}>
          <div>
            <div className={styles.statusHeading}>Documents:</div>
            <div className={styles.statusValue}>{stateInfo.documentCount}</div>
          </div>
          <div>
            <div className={styles.statusHeading}>Indexing time:</div>
            <div className={styles.statusValue}>{stateInfo.secondsToIndex} seconds</div>
          </div>
          <div>
            <div className={styles.statusHeading}>Search counter:</div>
            <div className={styles.statusValue}>{stateInfo.searchCounter}</div>
          </div>
          <div>
            <div className={styles.statusHeading}>Version:</div>
            <div className={styles.statusValue}>{stateInfo.version}</div>
          </div>
        </div>

        <button style={{ width: '200px', marginTop: '20px' }} onClick={toggleStatusClass}>Show StatusClass</button>

        {showStatusClass && (
        <ul>
          {Object.entries(stateInfo).map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong> {value !== null && value !== undefined ? value.toString() : 'N/A'}
            </li>
          ))}
          <li>
            <strong>Datasets:</strong>
            <ul>
              {Object.entries(datasetInfo).map(([dataset, value]) => (
                <li key={dataset}>
                  <strong>{value !== null && value !== undefined ? value.toString() : 'N/A'}</strong>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      )}

      </div>  

    </main>
  );
};

export default LoadIndx;
