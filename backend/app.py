import os
from flask import Flask, jsonify, request
from data_manager import FIFA20DataManager

# Initialize Flask app, telling it to serve static files from the 'frontend' directory
app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.config['JSON_AS_ASCII'] = False  # So accented names render correctly

# Load dataset (relative path to workspace folder)
CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../players_20.csv'))
data_manager = None

try:
    data_manager = FIFA20DataManager(CSV_PATH)
except Exception as e:
    print(f"CRITICAL ERROR LOADING DATA: {e}")

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/filters', methods=['GET'])
def get_filters():
    if not data_manager:
        return jsonify({'error': 'Data manager not initialized'}), 500
    try:
        filters = data_manager.get_unique_filter_values()
        return jsonify(filters)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/players', methods=['GET'])
def get_players():
    if not data_manager:
        return jsonify({'error': 'Data manager not initialized'}), 500
    
    try:
        search = request.args.get('search', '')
        position = request.args.get('position', 'ALL')
        club = request.args.get('club', 'ALL')
        nationality = request.args.get('nationality', 'ALL')
        min_overall = int(request.args.get('min_overall', 0))
        max_overall = int(request.args.get('max_overall', 100))
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 12))
        
        result = data_manager.get_players(
            search=search,
            position=position,
            club=club,
            nationality=nationality,
            min_overall=min_overall,
            max_overall=max_overall,
            page=page,
            per_page=per_page
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/players/<player_id>', methods=['GET'])
def get_player_details(player_id):
    if not data_manager:
        return jsonify({'error': 'Data manager not initialized'}), 500
        
    try:
        player = data_manager.get_player_details(player_id)
        if not player:
            return jsonify({'error': 'Player not found'}), 404
        return jsonify(player)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare', methods=['GET'])
def compare_players():
    if not data_manager:
        return jsonify({'error': 'Data manager not initialized'}), 500
        
    try:
        ids_str = request.args.get('ids', '')
        if not ids_str:
            return jsonify({'error': 'No player IDs provided'}), 400
            
        ids = [x.strip() for x in ids_str.split(',') if x.strip()]
        players_details = []
        for pid in ids:
            details = data_manager.get_player_details(pid)
            if details:
                players_details.append(details)
                
        return jsonify(players_details)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clustering', methods=['GET'])
def get_clustering():
    if not data_manager:
        return jsonify({'error': 'Data manager not initialized'}), 500
        
    try:
        k = int(request.args.get('k', 4))
        if k < 2 or k > 6:
            return jsonify({'error': 'Number of clusters must be between 2 and 6'}), 400
            
        result = data_manager.get_clustering_data(n_clusters=k)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting FIFA 20 Server on http://127.0.0.1:5000 ...")
    app.run(debug=True, port=5000)
