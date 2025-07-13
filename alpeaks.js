class AlpsPeakGame {
    constructor(q, debug) {
        this.peaksData = [];
        this.currentRegion = null;
        this.currentPeaks = [];
        this.currentPeakIndex = 0;
        this.score = 0;
        this.streak = 0;
        this.max_streak = 0;
        this.map = null;
        this.userGuess = null;
        this.guessMarker = null;
        this.currentPeakMarker = null;
        this.highScore = null;
        this.STORAGE_KEY = 'AlpeaksData';
        this.questions = q;
        this.debug = debug;
        this.debug_markers = [];

        fetch("data/regions.json")
            .then(response => response.json())
            .then(json => {
                this.regions = json;
                this.init();
            });
    }

    init() {
        this.loadHighScores();
        this.renderRegionButtons();
        this.setupEventListeners();
        this.loadPeaksData();
    }

    loadHighScores() {
        this.highScore = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        let sum = 0;
        console.log(this.highScore);
        Object.keys(this.highScore).forEach(e => { if (e != 'custom') sum += this.highScore[e]; });
        console.log(sum);
        console.log(((Object.keys(this.regions).length - 1)*1000));
        let percent = parseInt((sum/((Object.keys(this.regions).length - 1)*1000))*100);
        parseInt((sum/((Object.keys(this.regions).length - 1)*1000))*100);
        document.getElementById("overall-progress").value = percent;
        document.getElementById("overall-progress").setAttribute("data-label",  percent + "% completed");
    }
    
    updateHighScore() {
        if (! this.highScore[this.currentRegion] || this.highScore[this.currentRegion] < this.score) {
            this.highScore[this.currentRegion] = this.score;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.highScore));
            return true;
        }
        return false;
    }

    renderRegionButtons() {
        const regionGrid = document.getElementById('region-grid');
        regionGrid.innerHTML = this.generateRegionButtons();
    }

    setupEventListeners() {
        document.querySelectorAll('.region-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const region = e.currentTarget.dataset.region;
                if (region === 'custom') {
                    this.showCustomRegionSelector();
                } else {
                    this.startGame(region);
                }
            });
        });

        document.getElementById('validate-guess').addEventListener('click', () => {
            this.validateGuess();
        });
        document.getElementById('quit-game').addEventListener('click', () => {
            this.quitGame();
        });

        document.getElementById('submit-custom').addEventListener('click', () => {
            this.submitCustomRegion();
        });

        document.getElementById('cancel-custom').addEventListener('click', () => {
            this.cancelCustomRegion();
        });
    }

    async loadPeaksData() {
        try {
            // https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bnode%5B%22natural%22%3D%22peak%22%5D(44.0%2C5.0%2C48.0%2C15.0)%3Bout%3B
            // https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bnode%5B%22natural%22%3D%22peak%22%5D(47.6%2C6.3.0%2C48.8%2C7.5)%3Bout%3B
            // format slightly different
            const response = await fetch('data/data.json');
            if (!response.ok) {
                throw new Error('Could not load peaks data');
            }
            const data = await response.json();
            this.peaksData = data.features.filter(feature => 
                feature.properties.natural === 'peak' && 
                    feature.properties.name && 
                    feature.properties.ele
            );
            console.log(`Loaded ${this.peaksData.length} peaks`);
        } catch (error) {
            console.error('Error loading peaks data:', error);
            // Fallback: create some sample data for demonstration
            this.peaksData = this.createSampleData();
        }
    }

    createSampleData() {
        return [
            {
                properties: {
                    name: "Mont Blanc",
                    ele: "4809",
                    prominence: "4696"
                },
                geometry: {
                    coordinates: [6.8651, 45.8326]
                }
            },
            {
                properties: {
                    name: "Matterhorn",
                    ele: "4478",
                    prominence: "1042"
                },
                geometry: {
                    coordinates: [7.6583, 45.9763]
                }
            },
            {
                properties: {
                    name: "Eiger",
                    ele: "3967",
                    prominence: "362"
                },
                geometry: {
                    coordinates: [8.0056, 46.5775]
                }
            }
        ];
    }

    displayAllPeaks() {
        // first clean all
        this.debug_markers.forEach(m => {
            this.map.removeLayer(m);
        });
        this.debug_markers = []
        // display all
        this.allRegionPeaks.forEach( peak =>  {
            const [lng, lat] = peak.geometry.coordinates;
            let m = L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(this.map);
            this.debug_markers.push(m);
        });
    }
    
    startGame(region) {
        this.currentRegion = region;
        this.score = 0;
        this.streak = 0;
        this.max_streak = 0;
        this.currentPeakIndex = 0;
        this.updateScoreDisplay();
        document.getElementById('region-selection').style.display = 'none';
        document.getElementById('custom-region-selector').style.display = 'none';
        document.getElementById('loading').style.display = 'block';
        document.getElementById('endgame').display = "none";
        
        setTimeout(() => {
            this.selectPeaksForRegion(region);
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('header').style.display = 'none';
            document.getElementById('game-area').style.display = 'block';        
            
            // Initialize map after game area is visible
            setTimeout(() => {
                if (!this.map)
                    this.initMap();
                this.loadNextPeak();
                if (this.debug) {
                    this.displayAllPeaks();
                }

            }, 100);
        }, 1000);
    }

    selectPeaksForRegion(region) {
        const bounds = this.regions[region].bounds;
        const [[minLat, minLng], [maxLat, maxLng]] = bounds;
        
        const regionPeaks = this.peaksData.filter(peak => {
            const [lng, lat] = peak.geometry.coordinates;
            return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
        });
        
        // Select 10 random peaks
        this.allRegionPeaks =  this.shuffleArray(regionPeaks);
        this.currentPeaks = this.shuffleArray(regionPeaks).slice(0, this.questions);
        
        if (this.currentPeaks.length === 0) {
            alert("No peaks found in this region...");
            location.reload();
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    initMap() {
        const bounds = this.regions[this.currentRegion].bounds;
        
        this.map = L.map('map', {
            zoomControl: false,         // Remove zoom buttons
            scrollWheelZoom: false,     // Disable scroll wheel
            doubleClickZoom: false,     // Disable double-click zoom
            touchZoom: false,           // Disable pinch zoom on mobile
            dragging: true              // You can still allow dragging if desired
        }).fitBounds(bounds);

        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
            }).addTo(this.map);

        /*
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors & CartoDB',
          }).addTo(this.map);
        */
        /*
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
          }).addTo(this.map);
        */
        
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        var polygon = L.polygon([
            this.regions[this.currentRegion].bounds[0],
            [this.regions[this.currentRegion].bounds[0][0], this.regions[this.currentRegion].bounds[1][1]],
            this.regions[this.currentRegion].bounds[1],
            [this.regions[this.currentRegion].bounds[1][0], this.regions[this.currentRegion].bounds[0][1]],

        ]).addTo(this.map);

    }

    handleMapClick(e) {
        const { lat, lng } = e.latlng;
        this.userGuess = { lat, lng };
        
        if (this.guessMarker) {
            this.map.removeLayer(this.guessMarker);
        }
        /*
        this.guessMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'guess-marker',
                html: '<div style="font-size: 24px; color: red;">❓</div>',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            })
            }).addTo(this.map);
            */
        
        this.guessMarker = L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(this.map);
        
        
        document.getElementById('validate-guess').disabled = false;
    }

    loadNextPeak() {
        if (this.currentPeakIndex >= this.currentPeaks.length) {
            this.endGame();
            return;
        }
        
        const peak = this.currentPeaks[this.currentPeakIndex];
        
        document.getElementById('current-question').textContent = this.currentPeakIndex + 1 + "/" + this.currentPeaks.length;
        document.getElementById('peak-name').textContent = peak.properties.name;
        document.getElementById('peak-info').textContent = 
            `Elevation: ${peak.properties.ele}m${peak.properties.prominence ? ` | Prominence: ${peak.properties.prominence}m` : ''}`;
        
        // Clear previous markers and feedback
        if (this.guessMarker) {
            this.map.removeLayer(this.guessMarker);
            this.guessMarker = null;
        }
        if (this.currentPeakMarker) {
            this.map.removeLayer(this.currentPeakMarker);
            this.currentPeakMarker = null;
        }
        
        this.userGuess = null;
        document.getElementById('validate-guess').disabled = true;
        document.getElementById('feedback').style.display = 'none';
        document.getElementById('sb').style.display = 'flex';
    }

    validateGuess() {
        if (!this.userGuess) return;
        document.getElementById('validate-guess').disabled = true;
        const peak = this.currentPeaks[this.currentPeakIndex];
        const [peakLng, peakLat] = peak.geometry.coordinates;
        
        // Calculate distance between guess and actual peak
        const distance = this.calculateDistance(
            this.userGuess.lat, this.userGuess.lng,
            peakLat, peakLng
        );
        
        // Show the actual peak location
        this.currentPeakMarker = L.marker([peakLat, peakLng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(this.map);
        
        // Score based on distance (closer = higher score)
        let points = 0;
        let isCorrect = false;

        points = Math.max(0, Math.round(100-(3*distance)));
        isCorrect = points > 90;
        
        this.score += points;
        
        if (isCorrect) {
            this.streak++;
            if (this.streak > this.max_streak)
                this.max_streak = this.streak;
        } else {
            this.streak = 0;
        }
        
        this.updateScoreDisplay();
        this.showFeedback(isCorrect, distance, points);
        
        setTimeout(() => {
            this.currentPeakIndex++;
            this.loadNextPeak();
        }, 2000);
    }

    showFeedback(isCorrect, distance, points, skipped = false) {
        const feedback = document.getElementById('feedback');

        if (skipped) {
            feedback.textContent = 'Question skipped! The peak location is shown in green.';
            feedback.className = 'feedback incorrect';
        } else if (isCorrect) {
            feedback.textContent = `Excellent! You were ${distance.toFixed(1)}km and earned away  ${points} points!`;
            feedback.className = 'feedback correct';
        } else {
            feedback.textContent = `Not quite right. You were ${distance.toFixed(1)}km away and earned ${points} points.`;
            feedback.className = 'feedback incorrect';
        }
        document.getElementById('sb').style.display = 'none';                
        feedback.style.display = 'block';
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    updateScoreDisplay() {
        document.getElementById('score').textContent = this.score + " / " + ((this.currentPeakIndex+1)*100);
        document.getElementById('streak').textContent = this.streak;
        
    }

    endGame() {
        let record_msg = "";
        if (this.updateHighScore() ){
            record_msg = '<h2>🎉 New record! 🎉 </h2>';
        }
        
        document.getElementById('game-area').style.display = "none";
        document.getElementById('endgame').innerHTML = `
                    <div class="game-complete">
                        <h2>Game Complete!</h2>
                        <div class="final-score">${this.score} / ${this.currentPeaks.length * 100}</div>
                        ${record_msg}
                        <p>Max streak : ${this.max_streak}</p>
                        <button class="btn" onclick="location.reload()">Main menu</button>
                        <button class="btn" id="replay" >Play Again this region</button>
                    </div>
                `;
        document.getElementById('endgame').style.display = "block";
        document.getElementById("replay").addEventListener('click', () => {
            document.getElementById("endgame").style.display = "none";
            this.startGame(this.currentRegion);
        });

    }

    quitGame() {
        if (confirm('Are you sure you want to quit the current game?')) {
            location.reload();
        }
    }

    showCustomRegionSelector() {
        document.getElementById('region-selection').style.display = 'none';
        document.getElementById('custom-region-selector').style.display = 'block';
        
        // Initialize custom region map
        this.customMap = L.map('custom-map').setView([45.5, 6.5], 7);
        
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
        }).addTo(this.customMap);
        
        // Add rectangle selection
        this.customRectangle = null;
        this.customSelectionStart = null;
        this.customSelectionEnd = null;
        this.ongoing = false;
        this.mousedown = false;
        this.dragging = false;

        this.customMap.on('mousedown', (e) => {
            this.mousedown = true;
            console.log ("got click");
            this.dragging = false;
        });

        this.customMap.on('mousemove', (e) => {
            console.log("move");
            
            if (this.mousedown) {
                this.dragging = true;
            }
            
        });

        this.customMap.on('mouseup', (e) => {
            this.mousedown = false;
            if (!this.dragging) {
                if (this.customSelectionEnd && this.customSelectionStart) {
                    // reset
                    this.customSelectionStart = null;
                    this.updateCustomRectangle();
                    document.getElementById('submit-custom').disabled = true;
                    this.customSelectionEnd = null;
                }
                else if (!this.customSelectionStart && !this.customSelectionEnd) {
                    // restart
                    this.customSelectionStart = e.latlng;
                    this.customSelectionEnd = null;
                    this.updateCustomRectangle();
                    document.getElementById('submit-custom').disabled = true;
                    console.log ("new start");
                }
                else if (this.customSelectionStart && ! this.customSelectionEnd) {
                    this.customSelectionEnd = e.latlng;
                    this.updateCustomRectangle();
                    document.getElementById('submit-custom').disabled = false;
                    console.log ("start:");
                    console.log (this.customSelectionStart)
                    console.log ("end:");
                    console.log (this.customSelectionEnd)
                }
            }

        });

    }

    updateCustomRectangle() {
        
        if (this.customRectangle) {
            this.customMap.removeLayer(this.customRectangle);
        }
        
        if (this.customSelectionStart && !this.customSelectionEnd) {
            console.log("doing marker");
            if (this.customStartpoint) {
                this.map.removeLayer(customStartpoint);
            }
            console.log(this.customSelectionStart);
            this.customStartpoint = L.marker(this.customSelectionStart, {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(this.customMap);
        }
        else {
            if (this.customStartpoint) {
                this.customMap.removeLayer(this.customStartpoint);
            }
            this.customStartpoint = null;
        }
        
        if (this.customSelectionStart && this.customSelectionEnd) {
            const bounds = L.latLngBounds(this.customSelectionStart, this.customSelectionEnd);
            this.customRectangle = L.rectangle(bounds, {
                color: '#3498db',
                weight: 2,
                fillOpacity: 0.2
            }).addTo(this.customMap);
        }
    }

    submitCustomRegion() {
        if (this.customSelectionStart && this.customSelectionEnd) {
            const bounds = L.latLngBounds(this.customSelectionStart, this.customSelectionEnd);
            const customRegion = {
                bounds: [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]],
                name: "Custom Region",
                icon: "📍",
                description: "Your selected area"
            };
            console.log(customRegion);
            this.regions.custom = customRegion;
            this.startGame('custom');
        }
    }

    cancelCustomRegion() {
        document.getElementById('custom-region-selector').style.display = 'none';
        document.getElementById('region-selection').style.display = 'block';
        
        if (this.customMap) {
            this.customMap.remove();
            this.customMap = null;
        }
    }
    createRegionButton(regionKey, regionData) {
        let outout=`
                    <div class="region-card" data-region="${regionKey}">
                        <h3>${regionData.icon} ${regionData.name}</h3>
                        <p>${regionData.description}</p>`;
        if (this.highScore && this.highScore[regionKey])
            outout += `<p><i>${this.highScore[regionKey]} / 1000</i></p>`
        else
            outout += `<p><i>0 / 1000</i></p>`
        outout += `
                    </div>
                `;
        return outout;
    }

    generateRegionButtons() {
        let buttonsHTML = '';

        Object.entries(this.regions).forEach(([key, data]) => {
            buttonsHTML += this.createRegionButton(key, data);
        });
        
        // Add custom region button
        buttonsHTML += `
                    <div class="region-card" data-region="custom">
                        <h3>📍 Custom Region</h3>
                        <p>Select your own area<br>Draw a rectangle on the map<br>Choose any Alps region</p>
                    </div>
                `;
        
        return buttonsHTML;
    }

}

function get_param(p) {
    let url = window.location.href;
    var arr = url.split('?');
    let val = false;
    if (arr.length > 1 ) {
        arr[1].split('&').forEach(a => {
            args = a.split('=');
            if (args.length > 1 && args[0] == p) {
                val = args[1];
            }
        } );
    }
    return val;
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    let default_q = get_param('q') || 10;
    let debug_f = get_param('d');
    new AlpsPeakGame(default_q, debug_f);
});
