import csv
import os
import re
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

class FIFA20DataManager:
    def __init__(self, csv_path):
        self.csv_path = csv_path
        self.players_raw = []
        self.headers = []
        self.col_to_idx = {}
        
        # Display list of players (dicts)
        self.players_list = []
        self.players_by_id = {}
        
        # Preprocessing settings
        self.data_cols_del = [
            'sofifa_id', 'player_url', 'short_name', 'long_name', 'dob', 'nationality', 'club', 'overall', 'potential',
            'value_eur', 'preferred_foot', 'international_reputation', 'weak_foot', 'skill_moves',
            'body_type', 'real_face', 'player_tags', 'team_position', 'joined', 'contract_valid_until', 'player_traits',
            'nation_position', 'goalkeeping_diving', 'goalkeeping_positioning', 'goalkeeping_kicking', 'goalkeeping_handling',
            'goalkeeping_reflexes', 'wage_eur', 'release_clause_eur', 'team_jersey_number', 'nation_jersey_number', 'loaned_from'
        ]
        
        self.cols_to_upd2 = [
            'ls', 'st', 'rs', 'lw', 'lf', 'cf', 'rf', 'rw', 'lam', 'cam', 'ram', 'lm', 'lcm',
            'cm', 'rcm', 'rm', 'lwb', 'ldm', 'cdm', 'rdm', 'rwb', 'lb', 'lcb', 'cb', 'rcb', 'rb'
        ]
        
        self.dropped_model_cols = [
            'st', 'rs', 'rw', 'cf', 'rf', 'cam', 'ram', 'rm', 'cm', 'rcm', 'rwb', 'cdm', 'rdm', 'rb', 'cb', 'rcb'
        ]
        
        self.load_data()
        self.preprocess_data()
        # Default clustering (k=4)
        self.run_kmeans(n_clusters=4)

    def load_data(self):
        print(f"Loading data from {self.csv_path}...")
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"FIFA 20 CSV not found at {self.csv_path}")
            
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            self.headers = next(reader)
            self.col_to_idx = {name: idx for idx, name in enumerate(self.headers)}
            for row in reader:
                # Basic safety check on row length
                if len(row) == len(self.headers):
                    self.players_raw.append(row)
        print(f"Loaded {len(self.players_raw)} players successfully.")

    def _col_typ_chg(self, col_val):
        if not col_val or col_val.strip() == "":
            return 0.0
        try:
            return float(col_val)
        except ValueError:
            pass
        # Handle string formulas e.g., "89+2" or "89-2"
        col_val_spl = re.split('[-+]', col_val)
        try:
            col_val_int = list(map(int, col_val_spl))
        except ValueError:
            return 0.0
        if "+" in col_val:
            return float(sum(col_val_int))
        elif len(col_val_int) >= 2:
            return float(col_val_int[0] - col_val_int[1])
        return 0.0

    def preprocess_data(self):
        print("Preprocessing dataset...")
        
        # Build sets for label encoding
        positions_set = sorted(list(set(row[self.col_to_idx['player_positions']] for row in self.players_raw)))
        work_rates_set = sorted(list(set(row[self.col_to_idx['work_rate']] if row[self.col_to_idx['work_rate']] else "Medium/Medium" for row in self.players_raw)))
        
        self.pos_to_enc = {pos: idx for idx, pos in enumerate(positions_set)}
        self.wr_to_enc = {wr: idx for idx, wr in enumerate(work_rates_set)}
        
        # Identify keep columns
        self.keep_cols = [col for col in self.headers if col not in self.data_cols_del]
        
        # Build features matrix X and display list
        X_list = []
        
        for idx, row in enumerate(self.players_raw):
            sofifa_id = row[self.col_to_idx['sofifa_id']]
            short_name = row[self.col_to_idx['short_name']]
            long_name = row[self.col_to_idx['long_name']]
            overall = int(row[self.col_to_idx['overall']]) if row[self.col_to_idx['overall']] else 0
            potential = int(row[self.col_to_idx['potential']]) if row[self.col_to_idx['potential']] else 0
            value_eur = float(row[self.col_to_idx['value_eur']]) if row[self.col_to_idx['value_eur']] else 0.0
            wage_eur = float(row[self.col_to_idx['wage_eur']]) if row[self.col_to_idx['wage_eur']] else 0.0
            age = int(row[self.col_to_idx['age']]) if row[self.col_to_idx['age']] else 0
            club = row[self.col_to_idx['club']] if row[self.col_to_idx['club']] else "Free Agent"
            nationality = row[self.col_to_idx['nationality']] if row[self.col_to_idx['nationality']] else "Unknown"
            player_positions = row[self.col_to_idx['player_positions']]
            preferred_foot = row[self.col_to_idx['preferred_foot']]
            team_position = row[self.col_to_idx['team_position']] if row[self.col_to_idx['team_position']] else "Sub/Res"
            player_traits = row[self.col_to_idx['player_traits']] if row[self.col_to_idx['player_traits']] else ""
            
            # Store rich dictionary for API display
            player_dict = {
                'id': sofifa_id,
                'short_name': short_name,
                'long_name': long_name,
                'overall': overall,
                'potential': potential,
                'value_eur': value_eur,
                'wage_eur': wage_eur,
                'age': age,
                'club': club,
                'nationality': nationality,
                'player_positions': player_positions,
                'preferred_foot': preferred_foot,
                'team_position': team_position,
                'player_traits': player_traits,
                # Store core stats for comparison/profile
                'pace': int(row[self.col_to_idx['pace']]) if row[self.col_to_idx['pace']] else 0,
                'shooting': int(row[self.col_to_idx['shooting']]) if row[self.col_to_idx['shooting']] else 0,
                'passing': int(row[self.col_to_idx['passing']]) if row[self.col_to_idx['passing']] else 0,
                'dribbling': int(row[self.col_to_idx['dribbling']]) if row[self.col_to_idx['dribbling']] else 0,
                'defending': int(row[self.col_to_idx['defending']]) if row[self.col_to_idx['defending']] else 0,
                'physic': int(row[self.col_to_idx['physic']]) if row[self.col_to_idx['physic']] else 0,
                'height_cm': int(row[self.col_to_idx['height_cm']]) if row[self.col_to_idx['height_cm']] else 0,
                'weight_kg': int(row[self.col_to_idx['weight_kg']]) if row[self.col_to_idx['weight_kg']] else 0,
                'gk_diving': int(row[self.col_to_idx['gk_diving']]) if row[self.col_to_idx['gk_diving']] else 0,
                'gk_handling': int(row[self.col_to_idx['gk_handling']]) if row[self.col_to_idx['gk_handling']] else 0,
                'gk_kicking': int(row[self.col_to_idx['gk_kicking']]) if row[self.col_to_idx['gk_kicking']] else 0,
                'gk_reflexes': int(row[self.col_to_idx['gk_reflexes']]) if row[self.col_to_idx['gk_reflexes']] else 0,
                'gk_speed': int(row[self.col_to_idx['gk_speed']]) if row[self.col_to_idx['gk_speed']] else 0,
                'gk_positioning': int(row[self.col_to_idx['gk_positioning']]) if row[self.col_to_idx['gk_positioning']] else 0,
                'index': idx # Index in numpy matrices
            }
            self.players_list.append(player_dict)
            self.players_by_id[sofifa_id] = player_dict
            
            # Extract features for clustering
            row_features = []
            for col in self.keep_cols:
                val = row[self.col_to_idx[col]]
                if col == 'player_positions':
                    row_features.append(float(self.pos_to_enc[val]))
                elif col == 'work_rate':
                    row_features.append(float(self.wr_to_enc[val if val else "Medium/Medium"]))
                elif col in self.cols_to_upd2:
                    row_features.append(self._col_typ_chg(val))
                else:
                    if val == "":
                        row_features.append(0.0)
                    else:
                        try:
                            row_features.append(float(val))
                        except ValueError:
                            row_features.append(0.0)
            X_list.append(row_features)

        self.X = np.array(X_list, dtype=float)
        
        # Standardize features
        self.scaler = StandardScaler()
        self.X_scaled = self.scaler.fit_transform(self.X)
        
        # Filter for KMeans model input (drop duplicate/redundant features as in cell 128)
        drop_indices = [self.keep_cols.index(c) for c in self.dropped_model_cols if c in self.keep_cols]
        self.model_keep_indices = [i for i in range(len(self.keep_cols)) if i not in drop_indices]
        self.X_model_input = self.X_scaled[:, self.model_keep_indices]
        
        # Fit PCA (2D coordinates for cluster maps)
        print("Fitting PCA for 2D visualization mapping...")
        self.pca = PCA(n_components=2, random_state=9)
        self.coords_2d = self.pca.fit_transform(self.X_model_input)
        
        # Also store PCA coordinates in players_list for fast access
        for idx, player in enumerate(self.players_list):
            player['x'] = float(self.coords_2d[idx, 0])
            player['y'] = float(self.coords_2d[idx, 1])

        print(f"Preprocessing completed. Feature matrix shape: {self.X.shape}, Model input shape: {self.X_model_input.shape}")

    def run_kmeans(self, n_clusters=4):
        print(f"Fitting KMeans model with {n_clusters} clusters...")
        # Use exact random_state=9 as in the approved notebook
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=9, n_init=10)
        self.cluster_labels = self.kmeans.fit_predict(self.X_model_input)
        
        # Update labels in player dictionaries
        for idx, player in enumerate(self.players_list):
            player['cluster'] = int(self.cluster_labels[idx])
            
        print("KMeans fit complete.")
        return self.cluster_labels

    def get_players(self, search="", position="ALL", club="ALL", nationality="ALL", min_overall=0, max_overall=100, page=1, per_page=12):
        # Filter players
        filtered = []
        search_lower = search.lower().strip()
        
        for p in self.players_list:
            if search_lower and search_lower not in p['short_name'].lower() and search_lower not in p['long_name'].lower():
                continue
            if position != "ALL" and position not in p['player_positions']:
                continue
            if club != "ALL" and p['club'] != club:
                continue
            if nationality != "ALL" and p['nationality'] != nationality:
                continue
            if p['overall'] < min_overall or p['overall'] > max_overall:
                continue
            filtered.append(p)
            
        # Paginate
        total_items = len(filtered)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_players = filtered[start:end]
        
        return {
            'players': paginated_players,
            'total': total_items,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_items + per_page - 1) // per_page
        }

    def get_player_details(self, sofifa_id):
        player = self.players_by_id.get(sofifa_id)
        if not player:
            return None
            
        # Get raw stats for radar chart (normalized to 0-100)
        idx = player['index']
        raw_row = self.players_raw[idx]
        
        # Detailed stats categories for Radar Chart
        radar_stats = {
            'attacking': {
                'Crossing': int(raw_row[self.col_to_idx['attacking_crossing']]) if raw_row[self.col_to_idx['attacking_crossing']] else 0,
                'Finishing': int(raw_row[self.col_to_idx['attacking_finishing']]) if raw_row[self.col_to_idx['attacking_finishing']] else 0,
                'Heading Accuracy': int(raw_row[self.col_to_idx['attacking_heading_accuracy']]) if raw_row[self.col_to_idx['attacking_heading_accuracy']] else 0,
                'Short Passing': int(raw_row[self.col_to_idx['attacking_short_passing']]) if raw_row[self.col_to_idx['attacking_short_passing']] else 0,
                'Volleys': int(raw_row[self.col_to_idx['attacking_volleys']]) if raw_row[self.col_to_idx['attacking_volleys']] else 0,
            },
            'skill': {
                'Dribbling': int(raw_row[self.col_to_idx['skill_dribbling']]) if raw_row[self.col_to_idx['skill_dribbling']] else 0,
                'Curve': int(raw_row[self.col_to_idx['skill_curve']]) if raw_row[self.col_to_idx['skill_curve']] else 0,
                'FK Accuracy': int(raw_row[self.col_to_idx['skill_fk_accuracy']]) if raw_row[self.col_to_idx['skill_fk_accuracy']] else 0,
                'Long Passing': int(raw_row[self.col_to_idx['skill_long_passing']]) if raw_row[self.col_to_idx['skill_long_passing']] else 0,
                'Ball Control': int(raw_row[self.col_to_idx['skill_ball_control']]) if raw_row[self.col_to_idx['skill_ball_control']] else 0,
            },
            'movement': {
                'Acceleration': int(raw_row[self.col_to_idx['movement_acceleration']]) if raw_row[self.col_to_idx['movement_acceleration']] else 0,
                'Sprint Speed': int(raw_row[self.col_to_idx['movement_sprint_speed']]) if raw_row[self.col_to_idx['movement_sprint_speed']] else 0,
                'Agility': int(raw_row[self.col_to_idx['movement_agility']]) if raw_row[self.col_to_idx['movement_agility']] else 0,
                'Reactions': int(raw_row[self.col_to_idx['movement_reactions']]) if raw_row[self.col_to_idx['movement_reactions']] else 0,
                'Balance': int(raw_row[self.col_to_idx['movement_balance']]) if raw_row[self.col_to_idx['movement_balance']] else 0,
            },
            'power': {
                'Shot Power': int(raw_row[self.col_to_idx['power_shot_power']]) if raw_row[self.col_to_idx['power_shot_power']] else 0,
                'Jumping': int(raw_row[self.col_to_idx['power_jumping']]) if raw_row[self.col_to_idx['power_jumping']] else 0,
                'Stamina': int(raw_row[self.col_to_idx['power_stamina']]) if raw_row[self.col_to_idx['power_stamina']] else 0,
                'Strength': int(raw_row[self.col_to_idx['power_strength']]) if raw_row[self.col_to_idx['power_strength']] else 0,
                'Long Shots': int(raw_row[self.col_to_idx['power_long_shots']]) if raw_row[self.col_to_idx['power_long_shots']] else 0,
            },
            'mentality': {
                'Aggression': int(raw_row[self.col_to_idx['mentality_aggression']]) if raw_row[self.col_to_idx['mentality_aggression']] else 0,
                'Interceptions': int(raw_row[self.col_to_idx['mentality_interceptions']]) if raw_row[self.col_to_idx['mentality_interceptions']] else 0,
                'Positioning': int(raw_row[self.col_to_idx['mentality_positioning']]) if raw_row[self.col_to_idx['mentality_positioning']] else 0,
                'Vision': int(raw_row[self.col_to_idx['mentality_vision']]) if raw_row[self.col_to_idx['mentality_vision']] else 0,
                'Penalties': int(raw_row[self.col_to_idx['mentality_penalties']]) if raw_row[self.col_to_idx['mentality_penalties']] else 0,
                'Composure': int(raw_row[self.col_to_idx['mentality_composure']]) if raw_row[self.col_to_idx['mentality_composure']] else 0,
            },
            'defending': {
                'Marking': int(raw_row[self.col_to_idx['defending_marking']]) if raw_row[self.col_to_idx['defending_marking']] else 0,
                'Standing Tackle': int(raw_row[self.col_to_idx['defending_standing_tackle']]) if raw_row[self.col_to_idx['defending_standing_tackle']] else 0,
                'Sliding Tackle': int(raw_row[self.col_to_idx['defending_sliding_tackle']]) if raw_row[self.col_to_idx['defending_sliding_tackle']] else 0,
            },
            'goalkeeping': {
                'Diving': int(raw_row[self.col_to_idx['goalkeeping_diving']]) if raw_row[self.col_to_idx['goalkeeping_diving']] else 0,
                'Handling': int(raw_row[self.col_to_idx['goalkeeping_handling']]) if raw_row[self.col_to_idx['goalkeeping_handling']] else 0,
                'Kicking': int(raw_row[self.col_to_idx['goalkeeping_kicking']]) if raw_row[self.col_to_idx['goalkeeping_kicking']] else 0,
                'Positioning': int(raw_row[self.col_to_idx['goalkeeping_positioning']]) if raw_row[self.col_to_idx['goalkeeping_positioning']] else 0,
                'Reflexes': int(raw_row[self.col_to_idx['goalkeeping_reflexes']]) if raw_row[self.col_to_idx['goalkeeping_reflexes']] else 0,
            }
        }
        
        # Calculate recommendations (nearest neighbors in scaled feature space)
        similar_players = self.get_similar_players(player, limit=5)
        
        full_details = player.copy()
        full_details['radar_stats'] = radar_stats
        full_details['similar_players'] = similar_players
        
        return full_details

    def get_similar_players(self, player, limit=5):
        idx = player['index']
        # Distance calculation in the X_scaled feature space
        # Exclude self
        self_features = self.X_scaled[idx]
        distances = np.linalg.norm(self.X_scaled - self_features, axis=1)
        
        # Sort indices by distance
        nearest_indices = np.argsort(distances)
        
        similar = []
        for i in nearest_indices:
            if i == idx:
                continue
            similar_player = self.players_list[i]
            similar.append({
                'id': similar_player['id'],
                'short_name': similar_player['short_name'],
                'club': similar_player['club'],
                'overall': similar_player['overall'],
                'player_positions': similar_player['player_positions'],
                'distance': float(distances[i])
            })
            if len(similar) == limit:
                break
        return similar

    def get_unique_filter_values(self):
        clubs = sorted(list(set(p['club'] for p in self.players_list if p['club'] != "Free Agent")))
        nationalities = sorted(list(set(p['nationality'] for p in self.players_list if p['nationality'] != "Unknown")))
        positions = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST']
        return {
            'clubs': clubs,
            'nationalities': nationalities,
            'positions': positions
        }

    def get_clustering_data(self, n_clusters=4):
        # If dynamic clusters requested, run it and cache
        if self.kmeans.n_clusters != n_clusters:
            self.run_kmeans(n_clusters=n_clusters)
            
        # Return coordinates and cluster info for all players (limited to keep payload light, or top players + sampled ones)
        # To display nicely on a scatter plot without overwhelming the DOM, we can take the top 1500 players by overall,
        # plus a random sample of other players, or return all if needed.
        # Let's return the top 2000 players by overall rating so the scatter plot is clean and responsive.
        sorted_players = sorted(self.players_list, key=lambda x: x['overall'], reverse=True)
        plot_sample = sorted_players[:2000]
        
        points = []
        for p in plot_sample:
            points.append({
                'id': p['id'],
                'name': p['short_name'],
                'club': p['club'],
                'overall': p['overall'],
                'position': p['player_positions'],
                'cluster': p['cluster'],
                'x': p['x'],
                'y': p['y']
            })
            
        # Compile cluster summaries
        summaries = []
        for c in range(n_clusters):
            c_players = [p for p in self.players_list if p['cluster'] == c]
            c_size = len(c_players)
            avg_overall = sum(p['overall'] for p in c_players) / c_size if c_size > 0 else 0
            avg_age = sum(p['age'] for p in c_players) / c_size if c_size > 0 else 0
            avg_value = sum(p['value_eur'] for p in c_players) / c_size if c_size > 0 else 0
            
            # Find top positions in cluster
            pos_counts = {}
            for p in c_players:
                main_pos = p['player_positions'].split(',')[0].strip()
                pos_counts[main_pos] = pos_counts.get(main_pos, 0) + 1
            top_pos = sorted(pos_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            top_pos_str = ", ".join([f"{pos} ({count})" for pos, count in top_pos])
            
            # Top 3 players in this cluster
            top_players = sorted(c_players, key=lambda x: x['overall'], reverse=True)[:3]
            top_players_names = ", ".join([p['short_name'] for p in top_players])
            
            summaries.append({
                'cluster_id': c,
                'size': c_size,
                'avg_overall': round(avg_overall, 1),
                'avg_age': round(avg_age, 1),
                'avg_value': round(avg_value / 1e6, 2), # In Millions
                'top_positions': top_pos_str,
                'top_players': top_players_names
            })
            
        return {
            'points': points,
            'summaries': summaries
        }
