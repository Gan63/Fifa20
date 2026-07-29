import os
import sys
from data_manager import FIFA20DataManager

def run_tests():
    print("=== Testing FIFA 20 Backend Component ===")
    
    # 1. Test CSV path resolution
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../players_20.csv'))
    print(f"Resolving CSV path: {csv_path}")
    
    if not os.path.exists(csv_path):
        print(f"FAILED: CSV does not exist at {csv_path}")
        sys.exit(1)
        
    # 2. Instantiate data manager
    try:
        dm = FIFA20DataManager(csv_path)
        print("SUCCESS: Instantiated FIFA20DataManager")
    except Exception as e:
        print(f"FAILED: Instantiation failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    # 3. Test get_unique_filter_values
    try:
        filters = dm.get_unique_filter_values()
        print(f"SUCCESS: Filter values loaded. Clubs count: {len(filters['clubs'])}, Nationalities count: {len(filters['nationalities'])}")
        assert len(filters['clubs']) > 0
        assert len(filters['nationalities']) > 0
    except Exception as e:
        print(f"FAILED: Filter retrieval failed: {e}")
        sys.exit(1)

    # 4. Test player search pagination
    try:
        res = dm.get_players(search="Messi", page=1, per_page=5)
        players = res['players']
        print(f"SUCCESS: Player search works. Found {res['total']} players matching 'Messi'. Page 1 count: {len(players)}")
        assert len(players) > 0
        assert players[0]['short_name'] == 'L. Messi'
    except Exception as e:
        print(f"FAILED: Player search failed: {e}")
        sys.exit(1)

    # 5. Test player detail retrieval & recommendations
    try:
        messi_id = '158023' # Sofifa ID for Messi
        details = dm.get_player_details(messi_id)
        print(f"SUCCESS: Player details retrieved for L. Messi. Overall: {details['overall']}, Club: {details['club']}")
        print(f"Recommendations count: {len(details['similar_players'])}")
        assert details['short_name'] == 'L. Messi'
        assert len(details['similar_players']) == 5
        print("Top recommendation:", details['similar_players'][0]['short_name'], "Distance:", details['similar_players'][0]['distance'])
    except Exception as e:
        print(f"FAILED: Player details failed: {e}")
        sys.exit(1)

    # 6. Test clustering PCA coordinates
    try:
        cluster_res = dm.get_clustering_data(n_clusters=4)
        print(f"SUCCESS: Clustering PCA data retrieved. Points count: {len(cluster_res['points'])}, Summaries count: {len(cluster_res['summaries'])}")
        assert len(cluster_res['points']) > 0
        assert len(cluster_res['summaries']) == 4
        for summary in cluster_res['summaries']:
            print(f"  Cluster {summary['cluster_id']}: Size={summary['size']}, Avg Overall={summary['avg_overall']}, Top Players=[{summary['top_players']}]")
    except Exception as e:
        print(f"FAILED: Clustering failed: {e}")
        sys.exit(1)
        
    print("\n=== All Tests Passed Successfully ===")

if __name__ == '__main__':
    run_tests()
