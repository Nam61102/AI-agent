
const fs = require('fs');
let content = fs.readFileSync('src/screens/PeopleScreen.tsx', 'utf8');

content = content.replace(
    'export const PeopleScreen = ({ onBackPress }: { onBackPress: () => void }) => {',
    'export const PeopleScreen = ({ onBackPress, onNavigateHome, onNavigateExtractions, onNavigateConnection }: any) => {'
);

const styles_to_add = \
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
\;
content = content.replace('});', styles_to_add);

const bottom_nav = \
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
\;

content = content.replace(/<\\/View>\\s*\\);\\s*}\\s*return/s, bottom_nav + '    );\n  }\n\n  return');
content = content.replace(/<\\/View>\\s*\\);\\s*};/s, bottom_nav + '  );\n};\n');

// Clean up any weird character replacements
content = content.replace(/\?1/g, '‹');
content = content.replace(//g, '‹');

fs.writeFileSync('src/screens/PeopleScreen.tsx', content, 'utf8');
console.log('patched');

