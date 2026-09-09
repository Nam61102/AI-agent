
import re

with open('src/screens/PeopleScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update props
content = content.replace(
    'export const PeopleScreen = ({ onBackPress }: { onBackPress: () => void }) => {',
    'export const PeopleScreen = ({ onBackPress, onNavigateHome, onNavigateExtractions, onNavigateConnection }: any) => {'
)

# 2. Add bottom nav styles
styles_to_add = '''
  bottomNavBar: {
    height: 60,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70
  },
  bottomNavIcon: {
    fontSize: 18,
    color: '#64748B'
  },
  bottomNavIconActive: {
    color: '#4F46E5'
  },
  bottomNavLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
  },
  bottomNavLabelActive: {
    color: '#4F46E5',
    fontWeight: '700'
  }
});
'''
content = content.replace('});', styles_to_add, 1) # Only replace the last one

# 3. Add Bottom Navigation bar to both returns
bottom_nav = '''
        <View style={styles.bottomNavBar}>
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateHome || onBackPress} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>?</Text>
            <Text style={styles.bottomNavLabel}>Dashboard</Text>
          </TouchableOpacity>
  
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateExtractions} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>??</Text>
            <Text style={styles.bottomNavLabel}>Extractions</Text>
          </TouchableOpacity>
  
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateConnection} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>??</Text>
            <Text style={styles.bottomNavLabel}>Connection</Text>
          </TouchableOpacity>
        </View>
      </View>
'''

content = content.replace('      </View>\\n    );\\n  }', bottom_nav + '\\n    );\\n  }')
content = content.replace('      </View>\\n  );\\n};', bottom_nav + '\\n  );\\n};')

# 4. Fix corrupt header back texts
content = content.replace('‹', '‹') # Ensure it's correct
content = content.replace('?1', '‹')
content = content.replace('?1 Back', '‹ Back')

with open('src/screens/PeopleScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

