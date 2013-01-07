/**
 * Represents the writer which is used by a parser instance and is called upon to
 * translate the obtained intelligence to instructions leading to a functional
 * JavaScript implementation which relies on an engine to mediate template
 * completion.
 */
function Writer() {
	// Initialize the element insert. This is used to write an element definition before written control flow statements.
	this.elementInsert = -1;
	// Initialize the include depth. This is used to determine the op# variable name.
	this.includeDepth = 0;
	// Initialize the instructions. This is used to add each instruction which forms the functional JavaScript implementation.
	this.instructions = ['var r=[];'];
	// Initialize the partial depth. This is used to find partial type (differentiating between direct or include queue).
	this.partialDepth = 0;
	// Initialize the priorities. This is used to ensure the proper emitting order of instructions.
	this.priorities = ['data-include', 'data-partial', 'data-if', 'data-each'];
	// Initialize the variable depth. This is used to determine the v# variable name.
	this.variableDepth = 0;
}

/**
 * Arrange attributes to a ensure a proper emitting.
 *
 * @param attributes The attributes.
 * @param reverse Indicates whether the sorting is to be reversed.
 */
Writer.prototype.arrange = function (attributes, reverse) {
	// Initialize self.
	var self = this;
	// Initialize the find index function.
	var findIndex = function (key) {
		// Iterate through each priority.
		for (var i = 0; i < self.priorities.length; i++) {
			// Check if the priority matches the key.
			if (self.priorities[i] == key) {
				// Return the index.
				return i;
			}
		}
		// Return minus one.
		return -1;
	}
	// Sort the attributes.
	attributes.sort(function (a, b) {
		// Retrieve the priority index and sort.
		return reverse ? findIndex(a.key) < findIndex(b.key) : findIndex(a.key) > findIndex(b.key);
	});
};

/**
 * Begin a command statement.
 *
 * @param attributes The attributes.
 * @returns Indicates whether the element is to be disposed of.
 */
Writer.prototype.begin = function (attributes) {
	// Initialize the response.
	var response = false;
	// Initialize self.
	var self = this;
	// Define the function to clean the attribute and track the element insert.
	var cleanAttributeAndTrack = function (i) {
		// Check if the element insert is invalid.
		if (self.elementInsert == -1) {
			// Set the element insert.
			self.elementInsert = self.instructions.length;
		}
		// Delete the attribute.
		delete attributes[i];
		// Set the response.
		response = true;
	};
	// Arrange attributes to a ensure a proper emitting.
	this.arrange(attributes);
	// Set the element insert to invalid.
	this.elementInsert = -1;
	// Iterate through each attribute.
	for (var i = 0; i < attributes.length; i++) {
		// Switch based on the attribute key.
		switch (attributes[i].key) {
			// Check if this is an each statement.                       
			case 'data-each':
				// Retrieve the name of the variable.
				var variable = 'v' + this.variableDepth + '.' + attributes[i].value;
				// Retrieve the name of the iterator.
				var iterator = 'i' + this.variableDepth;
				// Increment the variable depth.
				this.variableDepth += 1;
				// Clean the attribute and track the element insert.
				cleanAttributeAndTrack(i);
				// Push the instruction to open an if statement.
				this.instructions.push('if(' + variable + '){');
				// Push the instruction to start an iteration.
				this.instructions.push('for(var ' + iterator + '=0;' + iterator + '<' + variable + '.length;' + iterator + '++){');
				// Push the instruction to create a variable with the new depth.
				this.instructions.push('var v' + this.variableDepth + '=' + variable + '[' + iterator + '];');
				// Break from iteration.
				break;
			// Check if this is an if statement.                  
			case 'data-if':
				// Determine if the if statement is negative.
				var isNegative = attributes[i].value.charAt(0) === '!';
				// Retrieve the value.
				var ifValue = isNegative ? attributes[i].value.substr(1) : attributes[i].value;
				// Clean the attribute and track the element insert.
				cleanAttributeAndTrack(i);
				// Push the instruction to open an if statement.
				this.instructions.push('if(' + (isNegative ? '!' : '') + 'v' + this.variableDepth + '.' + ifValue + '){');
				// Break from iteration.
				break;
			// Check if this is a include statement.                 
			case 'data-include':
				// Increment the include depth.
				this.includeDepth += 1;
				// Increment the partial depth.
				this.partialDepth += 1;
				// Clean the attribute and track the element insert.
				cleanAttributeAndTrack(i);
				// Push the instruction to initialize the output partial array.
				this.instructions.push('var op' + this.includeDepth + '=[];');
				// Break from iteration.
				break;
			// Check if this is a partial statement.                 
			case 'data-partial':
				// Retrieve the value.
				var partialValue = attributes[i].value;
				// Clean the attribute and track the element insert.
				cleanAttributeAndTrack(i);
				// Check if the partial depth indicates being in an include scope.
				if (this.partialDepth !== 0) {
					// Push the instruction to open a partial.
					this.instructions.push('op' + this.includeDepth + '[\'' + partialValue.replace('\'', '\\\'') + '\']=function(){');
					// Push the instruction to initialize the partial response array.
					this.instructions.push('var r=[];');
				}
				// Decrement the partial depth.
				this.partialDepth -= 1;
				// Break from iteration.
				break;
		}
	}
	// Return the response.
	return response;
};

/**
 * End a command statement.
 *
 * @param attributes The attributes.
 */
Writer.prototype.end = function (attributes) {
	// Arrange attributes to a ensure a proper emitting.
	this.arrange(attributes, true);
	// Iterate through each attribute.
	for (var i = 0; i < attributes.length; i++) {
		// Switch based on the attribute key.
		switch (attributes[i].key) {
			// Check if this is an if statement.  
			case 'data-each':
				// Push the instruction to close an each statement.
				this.instructions.push('}}');
				// Decrement the variable depth.
				this.variableDepth -= 1;
				// Break from iteration.
				break;
			// Check if this is an if statement.  
			case 'data-if':
				// Push the instruction to close an if statement.
				this.instructions.push('}');
				// Break from iteration.
				break;
			// Check if this is a include statement.  
			case 'data-include':
				// Push the instruction to include a template using the output partial array.
				this.instructions.push('r.push(e.include(\'' + attributes[i].value.replace('\'', '\\\'') + '\',v' + this.variableDepth + ',op' + this.includeDepth + '));');
				// Decrement the include depth.
				this.includeDepth -= 1;
				// Decrement the partial depth.
				this.partialDepth -= 1;
				// Break from iteration.
				break;
			// Check if this is a partial statement.  
			case 'data-partial':
				// Increment the partial depth.
				this.partialDepth += 1;
				// Check if the partial depth indicates being in an include scope.
				if (this.partialDepth !== 0) {
					// Push the instruction to return the partial response array.
					this.instructions.push('return r.join(\'\');');
					// Push the instruction to close a partial.
					this.instructions.push('};');
				} else {
					// Push the partial direct instruction.
					this.instructions.push('r.push(e.partial(\'' + attributes[i].value.replace('\'', '\\\'') + '\',ip));');
				}
				// Break from iteration.
				break;
		}
	}
};

/**
 * Invoke a non-nested command statement.
 *
 * @param attributes The attributes.
 */
Writer.prototype.invoke = function (attributes) {
	// Arrange attributes to a ensure a proper emitting.
	this.arrange(attributes);
	// Iterate through each attribute.
	for (var i = 0; i < attributes.length; i++) {
		// Switch based on the attribute key.
		switch (attributes[i].key) {
			// Check if this is an include statement. 
			case 'data-include':
				// Push the include instruction.
				this.instructions.push('r.push(e.include(\'' + attributes[i].value.replace('\'', '\\\'') + '\',v' + this.variableDepth + '));');
				// Delete the attribute.
				delete attributes[i];
				// Return true.
				return true;
				// Check if this is a partial statement.
			case 'data-partial':
				// Push the partial direct instruction.
				this.instructions.push('r.push(e.partial(\'' + attributes[i].value.replace('\'', '\\\'') + '\',ip));');
				// Delete the attribute.
				delete attributes[i];
				// Return true.
				return true;
		}
	}
	// Return false.
	return false;
};

/**
 * Add a variable using each handler.
 * 
 * @param name The variable name.
 * @param handlers Each handler.
 * @param requiresEscaping Indicates whether HTML escaping is required.
 * @param isOpeningElement Indicates whether this literal is an opening element.
 */
Writer.prototype.variable = function (name, handlers, requiresEscaping, isOpeningElement) {
	// Initialize the value.
	var variable = 'v' + this.variableDepth + (name === 'this' ? '' : '.' + name);
	// Check if the variable is an escaped variable.
	if (requiresEscaping) {
		// Push the escape handler on the handler list.
		handlers.push('escape');
	}
	// Iterate through each handler.
	for (var i = 0; i < handlers.length; i += 1) {
		// Set the value to include the handler wrapped variable.
		variable = 'e.handler(\'' + handlers[i] + '\',' + variable + ')';
	}
	// Check if this literal is an opening element.
	if (isOpeningElement) {
		// Insert the variable instruction.
		this.instructions.splice(this.elementInsert, 0, 'r.push(' + variable + ');');
		// Increment the element insert location.
		this.elementInsert++;
	} else {
		// Push the variable instruction.
		this.instructions.push('r.push(' + variable + ');');
	}
};

/**
 * Add literal text.
 *
 * @param text The text.
 * @param isOpeningElement Indicates whether this literal is an opening element.
 */
Writer.prototype.text = function (text, isOpeningElement) {
	// Initialize the text to add.
	var textToAdd = 'r.push(\'' + text.replace('\'', '\\\'') + '\');';
	// Check if this literal is an opening element.
	if (isOpeningElement) {
		// Insert the text instruction.
		this.instructions.splice(this.elementInsert, 0, textToAdd);
		// Increment the element insert location.
		this.elementInsert++;
	} else {
		// Push the text instruction.
		this.instructions.push(textToAdd);
	}
};

/**
* Convert the written instructions to a functional JavaScript implementation.
*
* @returns The functional JavaScript implementation.
*/
Writer.prototype.toString = function () {
	// Join the instructions and return the output string.
	return this.instructions.join('') + 'return r.join(\'\');';
};

// Check if module is defined.
if (typeof module !== undefined) {
	// Export the writer.
	module.exports = Writer;
}