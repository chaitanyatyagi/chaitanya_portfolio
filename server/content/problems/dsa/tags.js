// ---------------------------------------------------------------------------
// Company tags for DSA problems (docs/ARCHITECTURE.md §8.12, §13.2).
// Each tag names a question on a public GeeksforGeeks company-wise interview
// list of the same question TYPE; our problem text, data and titles are
// original. dsa() in ./define.js attaches these by problem id.
// Lists checked 2026-11-21.
// ---------------------------------------------------------------------------
const SHEETS = {
  AMZ: ['Amazon', 'https://www.geeksforgeeks.org/amazon-sde-sheet-interview-questions-and-answers/', 'Amazon SDE sheet'],
  GGL: ['Google', 'https://www.geeksforgeeks.org/google-sde-sheet-interview-questions-and-answers/', 'Google SDE sheet'],
  ADB: ['Adobe', 'https://www.geeksforgeeks.org/interview-experiences/adobe-topics-interview-preparation/', 'Adobe SDE sheet'],
  GS: ['Goldman Sachs', 'https://www.geeksforgeeks.org/interview-experiences/goldman-sachs-topics-interview-preparation/', 'Goldman Sachs SDE sheet'],
  MS: ['Microsoft', 'https://www.geeksforgeeks.org/interview-experiences/microsoft-topics-interview-preparation/', 'Microsoft interview preparation'],
  FK: ['Flipkart', 'https://www.geeksforgeeks.org/interview-experiences/flipkart-topics-interview-preparation/', 'Flipkart SDE sheet'],
  SAM: ['Samsung', 'https://www.geeksforgeeks.org/interview-experiences/samsung-topics-interview-preparation/', 'Samsung interview preparation'],
  WMT: ['Walmart', 'https://www.geeksforgeeks.org/interview-prep/walmart-coding-interview-questions/', 'Walmart coding interview questions'],
};

// id → [[sheet, "question as listed"], …]
const T = {
  // pack 01 — arrays & matrices
  'dsa-zero-out-rows-cols': [['ADB', 'Set Matrix Zeroes'], ['MS', 'Set Matrix Zeros']],
  'dsa-pascal-triangle': [['AMZ', 'Pascal Triangle'], ['MS', 'Pascal Triangle']],
  'dsa-next-arrangement': [['ADB', 'Next Permutation'], ['GS', 'Next Permutation'], ['MS', 'Next Permutation']],
  'dsa-best-contiguous-sum': [['AMZ', 'Largest Sum Contiguous Subarray'], ['GGL', "Kadane's Algorithm"], ['FK', 'Largest Sum Contiguous Subarray'], ['SAM', 'Largest Sum Contiguous Subarray'], ['WMT', 'Maximum Subarray'], ['GS', 'Maximum Subarray']],
  'dsa-three-colour-sort': [['AMZ', 'Sort an array of 0s, 1s, and 2s'], ['GGL', "Sort an array of 0s, 1s and 2s"], ['ADB', 'Sort Array of 0s, 1s and 2s'], ['GS', 'Sort an Array of 0s, 1s and 2s'], ['MS', 'Sort 0s, 1s, and 2s']],
  'dsa-merge-sorted-in-place': [['AMZ', 'Merge Without Extra Space'], ['GGL', 'Merge Two Sorted Arrays Without Extra Space'], ['MS', 'Merge Without Extra Space']],
  'dsa-repeated-id-cycle': [['AMZ', 'Find duplicates in an array']],
  'dsa-count-inversions': [['AMZ', 'Count Inversions in an array'], ['GGL', 'Count Inversions'], ['GS', 'Count Inversions in an Array'], ['MS', 'Count Inversions'], ['FK', 'Count Inversions in an Array (Using Merge Sort)']],
  'dsa-important-reverse-pairs': [['MS', 'Count Reverse Pairs']],
  'dsa-sorted-grid-search': [['ADB', 'Search a 2D Matrix'], ['MS', 'Search in Sorted 2D Matrix']],
  'dsa-staircase-grid-search': [['AMZ', 'Search in a row-wise and column-wise sorted matrix'], ['GGL', 'Search in a row wise and column wise sorted matrix'], ['MS', 'Search in Row-Column Sorted']],
  'dsa-majority-half': [['GGL', 'Majority element'], ['MS', 'Majority Element']],
  'dsa-majority-third': [['MS', 'Majority Element II'], ['GGL', 'Count more than n/k occurrences']],
  'dsa-grid-path-count': [['ADB', 'Unique Paths'], ['MS', 'Unique Paths in a Grid']],
  'dsa-longest-consecutive-run': [['ADB', 'Longest Consecutive Sequence'], ['GS', 'Longest Consecutive Sequence'], ['GGL', 'Longest Consecutive Subsequence'], ['MS', 'Longest Consecutive Subsequence'], ['WMT', 'Longest Consecutive Sequence']],
  'dsa-zero-sum-span': [['MS', 'Largest Subarray with Sum 0']],
  'dsa-xor-target-subarrays': [['GGL', 'Count subarrays with given XOR'], ['GS', 'Subarray with Given XOR']],
  'dsa-subarray-sum-count': [['ADB', 'Subarray Sum Equals K'], ['GS', 'Subarray Sum Equals K'], ['GGL', 'Number of subarrays having sum exactly equal to k'], ['MS', 'Count Subarrays with Sum K']],
  'dsa-rotate-by-k': [['AMZ', 'Program for array rotation']],
  'dsa-move-zeros-end': [['MS', 'Move All Zeros to End'], ['FK', 'Move All Zeroes to End'], ['WMT', 'Move Zeroes']],
  'dsa-product-except-self': [['ADB', 'Product of Array Except Self'], ['GS', 'Product of Array Except Self'], ['FK', 'Product of Array Except Self'], ['WMT', 'Product of Array Except Self'], ['MS', 'Product Array Puzzle']],

  // pack 02 — two pointers & windows
  'dsa-pair-to-target': [['ADB', 'Two Sum'], ['GS', 'Two Sum'], ['MS', 'Two Sum'], ['WMT', 'Two Sum'], ['AMZ', 'Count pairs with given sum']],
  'dsa-triplets-zero': [['GS', '3Sum'], ['WMT', '3Sum'], ['GGL', 'Find all triplets with zero sum']],
  'dsa-quadruplets-target': [['MS', '4 - Sum']],
  'dsa-dedupe-sorted-in-place': [['WMT', 'Remove Duplicates from Sorted Array']],
  'dsa-trapped-rainwater': [['AMZ', 'Trapping Rain Water'], ['GGL', 'Trapping Rain Water'], ['MS', 'Trapping Rain Water'], ['WMT', 'Trapping Rain Water']],
  'dsa-widest-container': [['ADB', 'Container With Most Water'], ['GS', 'Container With Most Water'], ['MS', 'Container with most water'], ['WMT', 'Container With Most Water']],
  'dsa-ones-with-k-flips': [['MS', "Maximize number of 1's"]],
  'dsa-longest-distinct-substring': [['AMZ', 'Length of the longest substring without repeating characters'], ['GGL', 'Longest Substring Without Repeating Characters'], ['ADB', 'Longest Substring Without Repeating Characters'], ['GS', 'Longest Substring Without Repeating Characters'], ['MS', 'Longest Substring Without Repeating Characters'], ['FK', 'Longest Substring Without Repeating Characters'], ['WMT', 'Longest Substring Without Repeating Characters']],
  'dsa-repeat-replacement': [['MS', 'Longest Repeating Character Replacement']],
  'dsa-min-covering-window': [['AMZ', 'Find the smallest window in a string containing all characters of another string'], ['GGL', 'Smallest window in a string containing all characters of other string'], ['GS', 'Smallest Window Containing All Characters'], ['FK', 'Smallest Window Containing All Characters'], ['MS', 'Minimum Window Substring']],
  'dsa-anagram-windows': [['MS', 'Count Occurrences of Anagram']],
  'dsa-two-basket-fruits': [['GGL', 'Longest K unique characters substring']],
  'dsa-isomorphic-mapping': [['GGL', 'Isomorphic Strings Check'], ['MS', 'Isomorphic Strings']],

  // pack 03 — binary search & sorting
  'dsa-floor-ceil-sorted': [['GGL', 'Floor in a sorted array']],
  'dsa-rotated-search': [['AMZ', 'Search an element in a sorted and rotated array'], ['GGL', 'Search in a rotated array'], ['ADB', 'Search in Rotated Sorted Array'], ['GS', 'Search in Rotated Sorted Array'], ['MS', 'Search in Rotated Sorted Array'], ['FK', 'Search an element in a sorted and rotated array'], ['WMT', 'Search in Rotated Sorted Array']],
  'dsa-rotation-minimum': [['GGL', 'Find the minimum element in a sorted and rotated array'], ['ADB', 'Find Minimum in Sorted Rotated Array'], ['GS', 'Find Minimum in Sorted Rotated Array'], ['MS', 'Sorted and Rotated Minimum']],
  'dsa-lonely-element': [['ADB', 'Single Element in a Sorted Array']],
  'dsa-find-a-peak': [['AMZ', 'Find a peak element'], ['GGL', 'Peak element'], ['ADB', 'Find Peak Element'], ['GS', 'Find Peak Element'], ['MS', 'Peak Element'], ['FK', 'Find Peak Element']],
  'dsa-integer-nth-root': [['AMZ', 'Square root of an integer'], ['ADB', 'Sqrt(x)'], ['MS', 'Square Root']],
  'dsa-eating-speed': [['GGL', 'Koko Eating Bananas'], ['ADB', 'Koko Eating Bananas'], ['MS', "Koko Eating Banana's"]],
  'dsa-bouquet-days': [['ADB', 'Minimum Number of Days to Make m Bouquets'], ['MS', 'Minimum Days to make M Bouquets']],
  'dsa-ship-capacity': [['GGL', 'Capacity to ship packages within d days'], ['MS', 'Capacity to Ship Packages Within D Days']],
  'dsa-allocate-chapters': [['AMZ', 'Allocate minimum number of pages'], ['MS', 'Allocate Minimum Pages'], ['GGL', "The Painter's Partition Problem-II"]],
  'dsa-kth-of-two-sorted': [['GS', 'K-th Element of Two Sorted Arrays'], ['FK', 'K-th Element of Two Sorted Arrays']],
  'dsa-median-two-sorted': [['AMZ', 'Median of two sorted arrays of different sizes'], ['GGL', 'Median of 2 sorted arrays of different sizes'], ['ADB', 'Median of Two Sorted Arrays'], ['GS', 'Median of Two Sorted Arrays'], ['MS', 'Median of Two Sorted Arrays'], ['WMT', 'Median of Two Sorted Arrays']],
  'dsa-row-most-ones': [['GGL', "Maximum no of 1's row"], ['MS', 'Row with max 1s in Row-Wise Sorted']],
  'dsa-merge-sort-impl': [['GS', 'Merge Sort'], ['MS', 'Merge Sort']],
  'dsa-quickselect-kth': [['ADB', 'Kth Largest Element in an Array'], ['GS', 'Kth Largest Element in an Array'], ['WMT', 'Kth Largest Element in an Array'], ['GGL', 'Kth smallest element']],

  // pack 04 — strings
  'dsa-reverse-word-order': [['ADB', 'Reverse Words in a String'], ['FK', 'Reverse Words in a String']],
  'dsa-longest-palindromic-substring': [['GGL', 'Longest Palindromic Substring'], ['ADB', 'Longest Palindromic Substring'], ['GS', 'Longest Palindromic Substring'], ['MS', 'Longest Palindromic Substring'], ['FK', 'Longest Palindromic Substring'], ['WMT', 'Longest Palindromic Substring']],
  'dsa-count-palindromic-substrings': [['MS', 'Palindromic Substrings Count']],
  'dsa-roman-both-ways': [['AMZ', 'Roman Number to Integer'], ['ADB', 'Integer to Roman'], ['WMT', 'Roman to Integer']],
  'dsa-parse-int-strict': [['AMZ', 'Implement Atoi'], ['ADB', 'String to Integer (atoi)'], ['GS', 'String to Integer (atoi)'], ['FK', 'Implement String to Integer (atoi)']],
  'dsa-shared-prefix': [['ADB', 'Longest Common Prefix'], ['MS', 'Longest Common Prefix'], ['WMT', 'Longest Common Prefix']],
  'dsa-kmp-prefix-function': [['GGL', 'Longest prefix which is also suffix'], ['MS', 'Longest Prefix Suffix']],
  'dsa-z-function': [['MS', 'Z - Algorithm']],
  'dsa-rolling-hash-search': [['GGL', 'Rabin-Karp algorithm for pattern searching'], ['MS', 'Rabin Karp Algorithm']],
  'dsa-look-and-say': [['AMZ', 'Look-and-Say Sequence'], ['MS', 'Look and Say Pattern']],
  'dsa-repeat-until-substring': [['GGL', 'Minimum number of times a has to be repeated such that b is a substring of it']],
  'dsa-valid-anagram-groups': [['AMZ', 'Check whether two strings are an anagram of each other'], ['ADB', 'Check if Two Strings are Anagrams'], ['MS', 'Check if Two Strings are anagram of each other']],

  // pack 05 — linked lists
  'dsa-reverse-linked-list': [['AMZ', 'Reverse a linked list'], ['GGL', 'Reverse a linked list'], ['ADB', 'Reverse a Linked List'], ['GS', 'Reverse Linked List'], ['MS', 'Reverse Linked List'], ['FK', 'Reverse Linked List'], ['WMT', 'Reverse Linked List']],
  'dsa-middle-node': [['ADB', 'Find Middle of a Linked List'], ['MS', 'Middle of a linked list'], ['FK', 'Find the Middle of a Linked List'], ['WMT', 'Middle of the Linked List'], ['SAM', 'Find the middle of a given linked list']],
  'dsa-merge-two-sorted-lists': [['GS', 'Merge Two Sorted Lists'], ['MS', 'Merge two Sorted Linked Lists'], ['FK', 'Merge two sorted linked lists'], ['SAM', 'Merge two sorted linked lists']],
  'dsa-drop-nth-from-end': [['AMZ', 'Nth node from the end of linked list'], ['GGL', 'Nth node from end of linked list'], ['ADB', 'Nth Node from End of Linked List'], ['MS', 'Delete nth node from end of linked list'], ['FK', 'Nth Node from End of Linked List']],
  'dsa-add-digit-lists': [['AMZ', 'Add two numbers represented by linked lists'], ['ADB', 'Add Two Numbers'], ['GS', 'Add Two Numbers Represented by Linked Lists'], ['MS', 'Add two numbers represented by linked lists'], ['FK', 'Add two numbers represented by linked lists']],
  'dsa-detect-loop': [['AMZ', 'Detect loop in a linked list'], ['GGL', 'Find length of loop'], ['ADB', 'Detect Cycle in a Linked List'], ['GS', 'Linked List Cycle'], ['MS', 'Detect Loop in a linked list'], ['FK', 'Detect and Remove Loop in a Linked List'], ['SAM', 'Detect loop in a linked list']],
  'dsa-list-palindrome': [['AMZ', 'Function to check if a singly linked list is palindrome'], ['ADB', 'Palindrome Linked List'], ['MS', 'Palindrome Linked List']],
  'dsa-reverse-in-groups': [['ADB', 'Reverse Linked List in Groups'], ['GS', 'Reverse Linked List in Groups'], ['MS', 'Linked List Group Reverse'], ['FK', 'Reverse Linked List in Groups']],
  'dsa-reverse-between': [['GGL', 'Reverse a sublist of a linked list']],
  'dsa-list-intersection': [['AMZ', 'Intersection of Two Linked Lists'], ['GS', 'Intersection of Two Linked Lists'], ['MS', 'Intersection in Y-shaped Linked Lists'], ['FK', 'Intersection of Two Linked Lists']],
  'dsa-dedupe-sorted-list': [['ADB', 'Remove Duplicates from a Sorted Linked List'], ['MS', 'Remove Duplicates from Sorted Linked List']],
  'dsa-reorder-zigzag': [['ADB', 'Reorder List'], ['MS', 'Reorder Linked List']],
  'dsa-partition-around-x': [['MS', 'Partition Linked List around a given value']],
  'dsa-swap-adjacent-pairs': [['GGL', 'Pairwise swap nodes of a given linked list'], ['MS', 'Pairwise Swap Elements of Linked List']],
  'dsa-delete-middle': [['FK', 'Delete middle of linked list']],
  'dsa-copy-random-list': [['AMZ', 'Clone a linked list with next and random pointer'], ['ADB', 'Copy List with Random Pointer'], ['GS', 'Clone Linked List with Random Pointer'], ['MS', 'Clone Linked List with Next and Random Pointer'], ['FK', 'Clone a Linked List with Random Pointer']],

  // pack 06 — recursion & backtracking
  'dsa-all-subset-sums': [['GS', 'Subsets']],
  'dsa-unique-subsets': [['MS', 'Distinct Subsets']],
  'dsa-combination-sum-reuse': [['AMZ', 'Combination Sum'], ['GS', 'Combination Sum'], ['FK', 'Combination Sum'], ['WMT', 'Combination Sum']],
  'dsa-all-orderings': [['AMZ', 'Permutations of a given string'], ['FK', 'Permutations of a String / Array'], ['SAM', 'Write a program to print all permutations of a given string']],
  'dsa-palindrome-partitions': [['GS', 'Palindrome Partitioning'], ['MS', 'All Palindrome Partitions']],
  'dsa-n-queens': [['AMZ', 'N-Queen Problem'], ['ADB', 'N-Queens'], ['GS', 'N-Queens Problem'], ['MS', 'N Queens'], ['FK', 'N-Queens Problem']],
  'dsa-sudoku-solver': [['AMZ', 'Solve the Sudoku'], ['GS', 'Sudoku Solver'], ['MS', 'Sudoku Solver'], ['FK', 'Sudoku']],
  'dsa-graph-colouring': [['FK', 'M-Coloring Problem']],
  'dsa-maze-paths': [['AMZ', 'Rat in a Maze Problem - I'], ['GS', 'Rat in a Maze'], ['MS', 'Rat in a Maze'], ['FK', 'Rat in a Maze']],
  'dsa-keypad-words': [['GS', 'Letter Combinations of a Phone Number'], ['MS', 'Possible Words from Phone Digits'], ['FK', 'Letter Combinations of a Phone Number']],
  'dsa-balanced-parens-gen': [['ADB', 'Generate Parentheses'], ['GS', 'Generate Parentheses'], ['MS', 'Generate Parentheses'], ['WMT', 'Generate Parentheses']],
  'dsa-word-in-grid': [['AMZ', 'Find the string in grid'], ['GGL', 'Search a word in a 2d grid of characters'], ['ADB', 'Word Search'], ['GS', 'Word Search'], ['MS', 'Word Search'], ['WMT', 'Word Search']],

  // pack 07 — greedy & intervals
  'dsa-max-meetings-one-room': [['GGL', 'Activity Selection'], ['GS', 'Activity Selection Problem'], ['MS', 'N meetings in One Room'], ['FK', 'Activity Selection Problem']],
  'dsa-min-stations': [['AMZ', 'Minimum Platforms'], ['GGL', 'Minimum Platforms'], ['GS', 'Minimum Number of Platforms'], ['FK', 'Minimum Number of Platforms']],
  'dsa-deadline-jobs': [['GS', 'Job Sequencing with Deadlines'], ['MS', 'Job Sequencing Problem'], ['FK', 'Job Sequencing with Deadlines']],
  'dsa-fractional-knapsack': [['GS', 'Fractional Knapsack'], ['MS', 'Fractional Knapsack'], ['FK', 'Fractional Knapsack Problem']],
  'dsa-reach-the-end': [['AMZ', 'Jump Game'], ['GGL', 'Jump Game'], ['ADB', 'Jump Game'], ['GS', 'Jump Game'], ['MS', 'Minimum Jumps']],
  'dsa-fuel-loop': [['GGL', 'Find the first circular tour that visits all petrol pumps'], ['ADB', 'Gas Station'], ['GS', 'Gas Station'], ['MS', 'Gas Stations'], ['FK', 'Gas Station (Circular Tour / Petrol Pump Problem)']],
  'dsa-candy-ratings': [['FK', 'Candy Distribution Problem']],
  'dsa-feed-children': [['FK', 'Assign Cookies']],
  'dsa-merge-overlaps': [['AMZ', 'Overlapping Intervals'], ['ADB', 'Merge Intervals'], ['GS', 'Merge Intervals'], ['MS', 'Merge Overlapping Intervals'], ['FK', 'Merge Overlapping Intervals']],

  // pack 08 — stacks, heaps & design
  'dsa-queue-from-two-stacks': [['AMZ', 'Queue using two Stacks'], ['GS', 'Implement Queue Using Stacks'], ['MS', 'Implement Queue Using Stacks'], ['FK', 'Implement Queue using Stacks']],
  'dsa-stack-from-queue': [['AMZ', 'Stack using two queues'], ['GS', 'Implement Stack Using Queues'], ['MS', 'Stack Using Queue']],
  'dsa-min-stack': [['ADB', 'Min Stack'], ['GS', 'Design Stack with getMin() in O(1)'], ['MS', 'Min Stack'], ['FK', 'Design a stack that supports getMin() in O(1)']],
  'dsa-bracket-matching': [['AMZ', 'Check for Balanced Brackets in an expression (well-formedness) using Stack'], ['ADB', 'Valid Parentheses'], ['GS', 'Valid Parentheses'], ['MS', 'Valid Parentheses'], ['FK', 'Valid Parentheses'], ['WMT', 'Valid Parentheses']],
  'dsa-eval-rpn': [['FK', 'Evaluate Reverse Polish Notation']],
  'dsa-infix-to-postfix': [['GGL', 'Infix to postfix expression']],
  'dsa-decode-repeats': [['ADB', 'Decode String'], ['GS', 'Decode String']],
  'dsa-next-greater-circular': [['MS', 'Next Greatest Element in Circular Array']],
  'dsa-days-until-warmer': [['ADB', 'Daily Temperatures']],
  'dsa-histogram-rectangle': [['GGL', 'Maximum rectangular area in a histogram'], ['GS', 'Largest Rectangular Area in Histogram'], ['MS', 'Largest Rectangle in Histogram'], ['FK', 'Largest Rectangle in Histogram'], ['WMT', 'Largest Rectangle in Histogram']],
  'dsa-maximal-rectangle': [['GGL', 'Max rectangle'], ['MS', "Maximum Rectangle of 1's in Binary Matrix"]],
  'dsa-remove-k-digits': [['ADB', 'Remove K Digits']],
  'dsa-find-celebrity': [['AMZ', 'The Celebrity Problem'], ['GGL', 'The Celebrity Problem'], ['GS', 'The Celebrity Problem'], ['MS', 'The Celebrity Problem'], ['FK', 'The Celebrity Problem']],
  'dsa-window-max-deque': [['GGL', 'Sliding window maximum'], ['ADB', 'Sliding Window Maximum'], ['GS', 'Sliding Window Maximum'], ['MS', 'Sliding Window Maximum'], ['FK', 'Sliding Window Maximum'], ['WMT', 'Sliding Window Maximum']],
  'dsa-lru-cache': [['GGL', 'LRU Cache Implementation'], ['GS', 'LRU Cache'], ['MS', 'LRU Cache'], ['FK', 'LRU Cache'], ['WMT', 'LRU Cache']],
  'dsa-lfu-cache': [['GS', 'LFU Cache'], ['MS', 'LFU Cache'], ['WMT', 'LFU Cache']],
  'dsa-merge-k-sorted': [['AMZ', 'Merge K sorted linked lists'], ['ADB', 'Merge K Sorted Linked Lists'], ['GS', 'Merge K Sorted Lists'], ['MS', 'Merge K Sorted Linked Lists'], ['FK', 'Merge K Sorted Linked Lists'], ['WMT', 'Merge K Sorted Lists']],
  'dsa-k-closest-points': [['MS', 'K Closest Points to Origin']],
  'dsa-task-cooldown': [['ADB', 'Task Scheduler'], ['MS', 'Task Scheduler']],
  'dsa-no-adjacent-repeats': [['AMZ', 'Rearrange characters'], ['GGL', 'Rearrange characters'], ['MS', 'Rearrange Characters']],

  // pack 09 — binary trees
  'dsa-tree-traversals': [['AMZ', 'Inorder Traversal'], ['AMZ', 'Preorder Traversal']],
  'dsa-morris-inorder': [['AMZ', 'Inorder Traversal']],
  'dsa-level-order': [['ADB', 'Binary Tree Zigzag Level Order Traversal'], ['GS', 'Binary Tree Level Order Traversal'], ['AMZ', 'ZigZag Tree Traversal'], ['GGL', 'ZigZag Tree Traversal'], ['MS', 'Zig-Zag Tree Traversal'], ['FK', 'Level Order Traversal'], ['WMT', 'Binary Tree Zigzag Level Order Traversal']],
  'dsa-height-and-balance': [['AMZ', 'Height of Binary Tree'], ['GGL', 'Balanced binary tree or not'], ['GS', 'Check if Binary Tree is Height-Balanced'], ['MS', 'Balanced Binary Tree']],
  'dsa-tree-diameter': [['AMZ', 'Diameter of a Binary Tree'], ['ADB', 'Diameter of Binary Tree'], ['GS', 'Diameter of Binary Tree'], ['MS', 'Diameter of Binary Tree'], ['WMT', 'Diameter of Binary Tree']],
  'dsa-max-path-sum': [['GGL', 'Maximum path sum from any node'], ['ADB', 'Binary Tree Maximum Path Sum'], ['MS', 'Binary Tree Maximum Path Sum']],
  'dsa-same-and-mirror': [['MS', 'Identical Trees'], ['MS', 'Symmetric Tree'], ['GGL', 'Mirror Tree']],
  'dsa-boundary-walk': [['AMZ', 'Boundary Traversal of binary tree'], ['GGL', 'Boundary traversal of binary tree'], ['ADB', 'Boundary of Binary Tree'], ['MS', 'Boundary Traversal of Binary Tree']],
  'dsa-vertical-columns': [['GGL', 'Bottom view of binary tree'], ['MS', 'Vertical Tree Traversal'], ['MS', 'Top View of a Binary Tree'], ['FK', 'Vertical Order Traversal'], ['FK', 'Bottom View of Binary Tree']],
  'dsa-side-views': [['AMZ', 'Left View of Binary Tree'], ['AMZ', 'Right View of Binary Tree'], ['GGL', 'Left View of binary tree'], ['GS', 'Binary Tree Right View'], ['MS', 'Left View of a Binary Tree'], ['FK', 'Print Left View of Binary Tree'], ['SAM', 'Print Left View of a Binary Tree']],
  'dsa-max-level-width': [['FK', 'Maximum Width of Binary Tree']],
  'dsa-path-to-node': [['AMZ', 'Lowest Common Ancestor in a Binary Tree'], ['GGL', 'Lowest common ancestor in a binary tree'], ['ADB', 'Lowest Common Ancestor of a Binary Tree'], ['GS', 'Lowest Common Ancestor in Binary Tree'], ['MS', 'Lowest Common Ancestor']],
  'dsa-distance-k-nodes': [['MS', 'Nodes at Given Distance in Binary Tree']],
  'dsa-burn-tree': [['MS', 'Burning Tree']],
  'dsa-count-complete-tree': [['ADB', 'Count Complete Tree Nodes']],
  'dsa-build-pre-in': [['AMZ', 'Construct Tree from Inorder & Preorder'], ['ADB', 'Construct Binary Tree from Preorder and Inorder Traversal'], ['MS', 'Construct Tree from Inorder and Preorder']],
  'dsa-build-post-in': [['ADB', 'Construct Binary Tree from Inorder and Postorder Traversal']],
  'dsa-serialise-tree': [['AMZ', 'Serialize and Deserialize a Binary Tree'], ['ADB', 'Serialize and Deserialize Binary Tree'], ['GS', 'Serialize and Deserialize Binary Tree'], ['MS', 'Serialize and Deserialize Binary Tree'], ['FK', 'Serialize and Deserialize Binary Tree']],
  'dsa-flatten-to-list': [['AMZ', 'Flatten a binary tree into linked list']],
  'dsa-invert-tree': [['GGL', 'Mirror Tree'], ['MS', 'Mirror Tree']],
  'dsa-root-leaf-paths': [['AMZ', 'Root to leaf path sum'], ['GGL', 'Root to leaf paths sum'], ['MS', 'Root to Leaf Path Sum'], ['SAM', 'Root to leaf path sum equal to a given number']],

  // pack 10 — BSTs & tries
  'dsa-bst-insert-delete': [['FK', 'Delete Node in BST'], ['SAM', 'Binary Search Tree | Set 2 (Delete)']],
  'dsa-validate-bst': [['AMZ', 'Check for BST'], ['ADB', 'Check if Binary Tree is a BST'], ['GS', 'Check if a Binary Tree is a BST'], ['MS', 'Check for BST'], ['FK', 'Check if Binary Tree is BST']],
  'dsa-kth-in-bst': [['AMZ', 'Kth largest element in BST'], ['GGL', 'k-th smallest element in BST'], ['FK', 'Kth Smallest Element in BST'], ['SAM', "K'th Largest Element in BST when modification to BST is not allowed"]],
  'dsa-bst-lca': [['GS', 'Lowest Common Ancestor in BST'], ['FK', 'Lowest Common Ancestor in BST']],
  'dsa-bst-neighbours': [['MS', 'Inorder Successor in BST'], ['FK', 'Inorder Successor']],
  'dsa-sorted-to-balanced-bst': [['FK', 'Sorted Array to BST']],
  'dsa-bst-pair-sum': [['MS', 'Pair Sum in BST'], ['ADB', 'Binary Search Tree Iterator']],
  'dsa-recover-swapped-bst': [['MS', 'Recover Swapped BST']],
  'dsa-largest-bst-subtree': [['MS', 'Largest BST']],
  'dsa-merge-two-bsts': [['GGL', "Merge two BST 's"], ['FK', 'Merge Two BSTs']],
  'dsa-trie-basic': [['AMZ', 'Trie Insert and Search'], ['ADB', 'Implement Trie (Prefix Tree)'], ['GS', 'Implement Trie'], ['MS', 'Implement Trie']],
  'dsa-trie-counts': [['AMZ', 'Trie Delete']],
  'dsa-longest-buildable-word': [['GS', 'Longest Word in Dictionary']],
  'dsa-max-xor-pair': [['GS', 'Maximum XOR of Two Numbers']],

  // pack 11 — graph traversal
  'dsa-bfs-dfs-orders': [['AMZ', 'BFS of Graph'], ['AMZ', 'DFS of Graph'], ['GS', 'Breadth First Search (BFS)'], ['FK', 'Depth First Search (DFS)']],
  'dsa-count-provinces': [['GGL', 'Number of provinces'], ['MS', 'Number of Connected Components']],
  'dsa-count-islands': [['AMZ', 'Find the number of islands'], ['GGL', 'Find the number of islands'], ['ADB', 'Number of Islands'], ['GS', 'Number of Islands'], ['MS', 'Find the number of Islands'], ['FK', 'Number of Islands'], ['WMT', 'Number of Islands']],
  'dsa-flood-fill': [['GGL', 'Flood fill algorithm'], ['MS', 'Flood Fill'], ['FK', 'Flood Fill Algorithm']],
  'dsa-rotting-spread': [['AMZ', 'Minimum time required to rot all oranges'], ['GGL', 'Minimum time required to rot all oranges'], ['ADB', 'Rotting Oranges'], ['GS', 'Rotting Oranges'], ['MS', 'Rotten Oranges'], ['WMT', 'Rotting Oranges']],
  'dsa-cycle-undirected': [['AMZ', 'Detect cycle in an undirected graph'], ['GGL', 'Detect cycle in an undirected graph'], ['GS', 'Detect Cycle in an Undirected Graph'], ['MS', 'Detect Cycle in Undirected graph'], ['FK', 'Detect cycle in an undirected graph']],
  'dsa-cycle-directed': [['AMZ', 'Detect Cycle in a Directed Graph'], ['ADB', 'Detect Cycle in a Directed Graph'], ['GS', 'Detect Cycle in a Directed Graph'], ['MS', 'Detect Cycle in directed graph'], ['FK', 'Detect Cycle in a Directed Graph'], ['SAM', 'Detect Cycle in a Directed Graph']],
  'dsa-two-colourable': [['MS', 'Bipartite Graph']],
  'dsa-course-order': [['AMZ', 'Topological sort'], ['GGL', 'Course Schedule'], ['ADB', 'Course Schedule'], ['GS', 'Course Schedule II'], ['MS', 'Course Schedule - II'], ['FK', 'Topological Sorting'], ['WMT', 'Course Schedule']],
  'dsa-alien-alphabet': [['AMZ', 'Alien Dictionary'], ['GGL', 'Alien Dictionary'], ['MS', 'Alien Dictionary']],
  'dsa-word-ladder': [['GGL', 'Word Ladder I'], ['ADB', 'Word Ladder'], ['MS', 'Word Ladder II']],

  // pack 12 — shortest paths, MST & connectivity
  'dsa-dijkstra-with-path': [['AMZ', 'Dijkstra Algorithm'], ['GGL', "Dijkstra's shortest path algorithm"], ['GS', "Dijkstra's Shortest Path"], ['FK', "Dijkstra's Shortest Path Algorithm"], ['SAM', "Dijkstra's shortest path algorithm"]],
  'dsa-binary-maze-path': [['SAM', 'Shortest path in a Binary Maze']],
  'dsa-min-effort-route': [['MS', 'Path with Minimum Effort']],
  'dsa-cheapest-k-stops': [['MS', 'Shortest Path with atmost K Nodes']],
  'dsa-count-shortest-routes': [['MS', 'Number of Ways to Arrive at Destination']],
  'dsa-prim-mst': [['FK', "Prim's Minimum Spanning Tree (MST)"], ['MS', 'Minimum Spanning Tree']],
  'dsa-kruskal-mst': [['GGL', "Kruskal's Minimum Spanning Tree (MST) Algorithm"], ['MS', "Minimum Spanning Tree - Kruskal's Algorithm"], ['FK', "Kruskal's Minimum Spanning Tree (MST)"]],
  'dsa-strongly-connected': [['AMZ', "Strongly Connected Components (Kosaraju's Algo)"]],
  'dsa-critical-links': [['MS', 'Bridge Edge in a Graph'], ['MS', 'Find all Critical Connections in the Graph']],

  // pack 13 — DP I
  'dsa-stair-ways': [['ADB', 'Climbing Stairs'], ['GS', 'Climbing Stairs'], ['MS', 'Climbing Stairs']],
  'dsa-house-robber-line-and-ring': [['AMZ', 'Stickler Thief'], ['GGL', 'Stickler Thief'], ['ADB', 'House Robber'], ['GS', 'House Robber'], ['MS', 'House Robber'], ['WMT', 'House Robber']],
  'dsa-grid-paths-obstacles': [['ADB', 'Unique Paths II']],
  'dsa-min-path-sum': [['ADB', 'Minimum cost path'], ['MS', 'Minimum Cost Path']],
  'dsa-falling-path': [['MS', 'Maximum Path Sum in a Matrix']],
  'dsa-subset-sum-exists': [['AMZ', 'Partition Equal Subset Sum'], ['GS', 'Partition Equal Subset Sum'], ['MS', 'Subset Sum']],
  'dsa-knapsack-01': [['AMZ', '0 - 1 Knapsack Problem'], ['MS', '0 - 1 Knapsack'], ['FK', '0-1 Knapsack Problem']],
  'dsa-coin-ways': [['GGL', 'Coin Change - Count Ways To Make Sum'], ['MS', 'Coin Change (Count Ways)'], ['FK', 'Coin Change (Count Ways to Make Sum)']],
  'dsa-unbounded-knapsack': [['GGL', 'Knapsack with duplicate items'], ['MS', 'Rod Cutting']],
  'dsa-word-break': [['AMZ', 'Word Break'], ['GS', 'Word Break'], ['MS', 'Word Break'], ['FK', 'Word Break'], ['WMT', 'Word Break']],
  'dsa-egg-drop': [['AMZ', 'Egg Dropping Puzzle'], ['GS', 'Egg Dropping Problem'], ['SAM', 'Egg Dropping Puzzle']],

  // pack 14 — DP II
  'dsa-lcs-reconstruct': [['AMZ', 'Longest Common Subsequence'], ['MS', 'Longest Common Subsequence'], ['FK', 'Longest Common Subsequence (LCS)']],
  'dsa-longest-common-substring': [['AMZ', 'Longest Common Substring'], ['MS', 'Longest Common Substring']],
  'dsa-palindromic-subsequence': [['AMZ', 'Longest Palindromic Subsequence'], ['GGL', 'Minimum insertions to form a palindrome'], ['MS', 'Longest Palindromic Subsequence']],
  'dsa-shortest-supersequence': [['GGL', 'Shortest Common Supersequence'], ['MS', 'Shortest Common Supersequence']],
  'dsa-wildcard-match': [['AMZ', 'Wildcard Pattern Matching'], ['GGL', 'Wildcard Pattern Matching'], ['ADB', 'Wildcard Pattern Matching'], ['MS', 'Wildcard Pattern Matching'], ['FK', 'Wildcard Pattern Matching'], ['WMT', 'Wildcard Matching']],
  'dsa-regex-match': [['MS', 'Regular Expression Matching']],
  'dsa-stock-k-trades': [['MS', 'Stock Buy and Sell - Max K Transactions Allowed']],
  'dsa-lis-patience': [['ADB', 'Longest Increasing Subsequence'], ['GS', 'Longest Increasing Subsequence'], ['MS', 'Longest Increasing Subsequence'], ['FK', 'Longest Increasing Subsequence (LIS)'], ['WMT', 'Longest Increasing Subsequence'], ['SAM', 'Longest Increasing Subsequence']],
  'dsa-longest-bitonic': [['MS', 'Longest Bitonic Subsequence']],
  'dsa-matrix-chain': [['GGL', 'Brackets in matrix chain multiplication'], ['GS', 'Matrix Chain Multiplication'], ['MS', 'Matrix Chain Multiplication'], ['FK', 'Matrix Chain Multiplication']],
  'dsa-burst-balloons': [['GGL', 'Burst balloon to maximize coins']],
  'dsa-palindrome-min-cuts': [['GS', 'Palindrome Partitioning'], ['MS', 'Palindrome Partitioning'], ['FK', 'Palindrome Partitioning']],
  'dsa-count-squares': [['ADB', 'Maximal Square']],

  // pack 15 — bits & number theory
  'dsa-xor-singles': [['GS', 'Single Number'], ['GS', 'Find Two Non-Repeating Elements'], ['MS', 'Unique Number I']],
  'dsa-single-among-triples': [['MS', 'Unique Number II']],
  'dsa-bit-counts-range': [['ADB', 'Count Set Bits'], ['GS', 'Count Set Bits'], ['MS', 'Bit Counting'], ['FK', 'Count Set Bits']],
  'dsa-bit-tricks': [['AMZ', 'Power of 2'], ['ADB', 'Check if a Number is Power of Two'], ['GS', 'Position of Rightmost Set Bit'], ['FK', 'Power of Two']],
  'dsa-divide-by-shifting': [['MS', 'Division without using multiplication, division and mod operator']],
  'dsa-subsets-bitmask': [['GS', 'Subsets']],
  'dsa-flips-and-hamming': [['GS', 'Count Bits to Flip'], ['MS', 'Total Hamming Distance'], ['FK', 'Sum of Bit Differences Among All Pairs'], ['GGL', 'Sum of bit differences among all pairs'], ['SAM', 'Count number of bits to be flipped to convert A to B']],
  'dsa-gray-code': [['GS', 'Generate Gray Codes']],
  'dsa-reverse-bits': [['AMZ', 'Reverse Bits'], ['ADB', 'Reverse Bits'], ['GS', 'Reverse Bits'], ['FK', 'Reverse Bits of a Number']],
};

export function tagsFor(id) {
  const entries = T[id] || [];
  const sources = entries.map(([key, what]) => {
    const [company, url, sheet] = SHEETS[key];
    return { company, label: `GeeksforGeeks — ${sheet}: "${what}"`, url };
  });
  return { companies: [...new Set(sources.map((s) => s.company))], sources };
}

export const TAGGED_IDS = Object.keys(T);
